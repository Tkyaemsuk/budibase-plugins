<script>
  import { getContext, onMount } from "svelte"

  // ---- Settings passed from the Budibase builder (schema.json keys) ----
  export let dataProvider
  export let buttonText = "Export Csv"
  export let filename = "export"
  export let delimiter = "comma"
  export let includeBom = true
  export let allowDesigner = true
  export let configKey = ""
  export let buttonSize = "M"
  export let onExport

  // ---- Budibase runtime context ----
  const { styleable } = getContext("sdk")
  const component = getContext("component")

  // ---- Local state ----
  let open = false          // designer modal
  let columns = []          // [{ id, header, sourceField, transform }]
  let toast = ""            // small status message
  let loaded = false

  const uid = () => Math.random().toString(36).slice(2, 9)

  // Rows + schema exposed by the bound data provider (the provider is where
  // you pick your Table / datasource inside Budibase).
  $: rows = (dataProvider && dataProvider.rows) || []
  $: providerSchema = (dataProvider && dataProvider.schema) || {}
  $: tableLabel =
    (dataProvider && dataProvider.datasource && dataProvider.datasource.label) ||
    (dataProvider && dataProvider.datasource && dataProvider.datasource.tableId) ||
    ""

  // Detect selectable source fields from schema first, then fall back to row keys.
  $: detectedFields = deriveFields(providerSchema, rows)

  function deriveFields(schema, rowsIn) {
    let keys = []
    if (schema && Object.keys(schema).length) {
      keys = Object.keys(schema)
    } else if (rowsIn && rowsIn.length) {
      keys = Object.keys(rowsIn[0])
    }
    // Hide Budibase internal plumbing but keep _id in case the user wants it.
    return keys.filter(k => k === "_id" || !k.startsWith("_"))
  }

  const storageKey = () =>
    "csvExportPro:" + (configKey || (component && $component && $component.id) || "default")

  onMount(() => {
    try {
      const raw = window.localStorage.getItem(storageKey())
      if (raw) columns = JSON.parse(raw)
    } catch (e) {
      /* ignore */
    }
    loaded = true
  })

  // First run with no saved design -> auto-build one column per detected field.
  $: if (loaded && columns.length === 0 && detectedFields.length) {
    columns = detectedFields.map(f => ({
      id: uid(),
      header: prettify(f),
      sourceField: f,
      transform: "",
    }))
  }

  function prettify(key) {
    return String(key)
      .replace(/[_-]+/g, " ")
      .replace(/\b\w/g, c => c.toUpperCase())
      .trim()
  }

  // ---------- Column designer actions ----------
  function addColumn() {
    columns = [...columns, { id: uid(), header: "Column " + (columns.length + 1), sourceField: "", transform: "" }]
  }
  function removeColumn(id) {
    columns = columns.filter(c => c.id !== id)
  }
  function duplicateColumn(id) {
    const i = columns.findIndex(c => c.id === id)
    if (i < 0) return
    const copy = { ...columns[i], id: uid(), header: columns[i].header + " copy" }
    columns = [...columns.slice(0, i + 1), copy, ...columns.slice(i + 1)]
  }
  function move(id, dir) {
    const i = columns.findIndex(c => c.id === id)
    const j = i + dir
    if (i < 0 || j < 0 || j >= columns.length) return
    const next = columns.slice()
    ;[next[i], next[j]] = [next[j], next[i]]
    columns = next
  }
  function autoGenerate() {
    columns = detectedFields.map(f => ({ id: uid(), header: prettify(f), sourceField: f, transform: "" }))
    flash("Regenerated " + columns.length + " column(s) from data")
  }
  function saveDesign() {
    try {
      window.localStorage.setItem(storageKey(), JSON.stringify(columns))
      flash("Design saved")
    } catch (e) {
      flash("Save failed: " + e.message)
    }
  }
  function resetDesign() {
    columns = []
    try {
      window.localStorage.removeItem(storageKey())
    } catch (e) {
      /* ignore */
    }
    flash("Design reset")
  }
  function flash(msg) {
    toast = msg
    setTimeout(() => (toast = msg === toast ? "" : toast), 2200)
  }

  // ---------- Helpers available inside user JS transforms ----------
  const helpers = {
    upper: v => (v == null ? "" : String(v).toUpperCase()),
    lower: v => (v == null ? "" : String(v).toLowerCase()),
    trim: v => (v == null ? "" : String(v).trim()),
    round: (v, d = 0) => {
      const n = Number(v)
      const m = Math.pow(10, d)
      return isNaN(n) ? "" : Math.round(n * m) / m
    },
    number: v => {
      const n = Number(v)
      return isNaN(n) ? "" : n
    },
    date: (v, locale = "th-TH") => {
      const d = new Date(v)
      return isNaN(d.getTime()) ? "" : d.toLocaleDateString(locale)
    },
    join: (v, sep = ", ") => (Array.isArray(v) ? v.join(sep) : v == null ? "" : String(v)),
  }

  // Compile a per-column transform once (cached by body string).
  const transformCache = {}
  function compileTransform(body) {
    if (transformCache[body]) return transformCache[body]
    const src = /\breturn\b/.test(body) ? body : "return (" + body + ")"
    let fn
    try {
      // eslint-disable-next-line no-new-func
      fn = new Function("value", "row", "index", "helpers", src)
    } catch (e) {
      fn = () => "#ERR:" + e.message
    }
    transformCache[body] = fn
    return fn
  }

  function cellValue(col, row, index) {
    let value = col.sourceField ? row[col.sourceField] : undefined
    if (col.transform && col.transform.trim()) {
      try {
        value = compileTransform(col.transform)(value, row, index, helpers)
      } catch (e) {
        value = "#ERR:" + e.message
      }
    }
    return value
  }

  // ---------- CSV building ----------
  function delimChar() {
    if (delimiter === "semicolon") return ";"
    if (delimiter === "tab") return "\t"
    return ","
  }

  function esc(val, d) {
    if (val === null || val === undefined) return ""
    let s = typeof val === "object" ? JSON.stringify(val) : String(val)
    if (s.indexOf('"') !== -1 || s.indexOf(d) !== -1 || s.indexOf("\n") !== -1 || s.indexOf("\r") !== -1) {
      s = '"' + s.replace(/"/g, '""') + '"'
    }
    return s
  }

  function buildMatrix() {
    const cols = columns.length
      ? columns
      : detectedFields.map(f => ({ id: f, header: f, sourceField: f, transform: "" }))
    const header = cols.map(c => c.header || "")
    const body = rows.map((row, i) => cols.map(c => cellValue(c, row, i)))
    return [header, ...body]
  }

  function exportCsv() {
    if (!rows.length) {
      flash("No rows to export")
      return
    }
    const d = delimChar()
    const matrix = buildMatrix()
    const csv = matrix.map(r => r.map(c => esc(c, d)).join(d)).join("\r\n")

    // UTF-8 with BOM so Excel reads Thai (and other UTF-8) correctly instead of
    // falling back to Windows-1252 and corrupting the text.
    const bom = includeBom ? "\uFEFF" : ""
    const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8;" })
    const name = (filename || "export") + ".csv"

    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = name
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    flash("Exported " + rows.length + " row(s)")
    if (typeof onExport === "function") {
      onExport({ rowCount: rows.length, fileName: name })
    }
  }

  // ---------- Excel-like preview ----------
  $: previewCols = columns.length
    ? columns
    : detectedFields.map(f => ({ id: f, header: prettify(f), sourceField: f, transform: "" }))
  $: previewRows = rows.slice(0, 12)

  function colLetter(n) {
    let s = ""
    n = n + 1
    while (n > 0) {
      const r = (n - 1) % 26
      s = String.fromCharCode(65 + r) + s
      n = Math.floor((n - 1) / 26)
    }
    return s
  }
</script>

<div use:styleable={$component.styles} class="cep-root">
  <div class="cep-actions">
    <button class="cep-btn cep-primary cep-{buttonSize}" on:click={exportCsv}>
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
        <path
          fill="currentColor"
          d="M12 3v10.6l3.3-3.3 1.4 1.4L12 17.4l-4.7-4.7 1.4-1.4L12 13.6V3h0zM5 19h14v2H5z"
        />
      </svg>
      <span>{buttonText || "Export Csv"}</span>
    </button>

    {#if allowDesigner}
      <button
        class="cep-btn cep-ghost cep-{buttonSize}"
        title="Design columns"
        on:click={() => (open = true)}
      >
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
          <path
            fill="currentColor"
            d="M3 3h18v4H3V3zm0 6h6v12H3V9zm8 0h10v6H11V9zm0 8h10v4H11v-4z"
          />
        </svg>
        <span>Design</span>
      </button>
    {/if}
  </div>

  {#if toast}
    <div class="cep-toast">{toast}</div>
  {/if}
</div>

{#if open}
  <div class="cep-overlay" on:click|self={() => (open = false)}>
    <div class="cep-modal">
      <!-- Header -->
      <div class="cep-modal-head">
        <div class="cep-title">
          <strong>CSV Export Pro</strong>
          <span class="cep-sub">
            {rows.length} row(s){tableLabel ? " · " + tableLabel : ""} · {columns.length ||
              detectedFields.length} column(s)
          </span>
        </div>
        <button class="cep-x" on:click={() => (open = false)} title="Close">×</button>
      </div>

      <!-- Toolbar -->
      <div class="cep-toolbar">
        <button class="cep-btn cep-ghost cep-S" on:click={addColumn}>+ Add column</button>
        <button class="cep-btn cep-ghost cep-S" on:click={autoGenerate}>⟳ From data</button>
        <div class="cep-spacer"></div>
        <button class="cep-btn cep-ghost cep-S" on:click={resetDesign}>Reset</button>
        <button class="cep-btn cep-ghost cep-S" on:click={saveDesign}>Save design</button>
        <button class="cep-btn cep-primary cep-S" on:click={exportCsv}>Export Csv</button>
      </div>

      <div class="cep-body">
        <!-- Column configuration -->
        <div class="cep-config">
          <div class="cep-config-head">
            <span class="cep-cell-idx">#</span>
            <span>Header (Excel column)</span>
            <span>Source field</span>
            <span>JavaScript transform (optional)</span>
            <span class="cep-cell-ops">Order</span>
          </div>

          {#each columns as col, i (col.id)}
            <div class="cep-config-row">
              <span class="cep-cell-idx" title="Column {colLetter(i)}">{colLetter(i)}</span>

              <input
                class="cep-input"
                type="text"
                placeholder="Header name"
                bind:value={col.header}
              />

              <select class="cep-input" bind:value={col.sourceField}>
                <option value="">— custom / transform only —</option>
                {#each detectedFields as f}
                  <option value={f}>{f}</option>
                {/each}
              </select>

              <input
                class="cep-input cep-code"
                type="text"
                placeholder="e.g. value + ' บาท'   |   vars: value, row, index, helpers"
                bind:value={col.transform}
              />

              <span class="cep-cell-ops">
                <button class="cep-mini" title="Move up" on:click={() => move(col.id, -1)}>▲</button>
                <button class="cep-mini" title="Move down" on:click={() => move(col.id, 1)}>▼</button>
                <button class="cep-mini" title="Duplicate" on:click={() => duplicateColumn(col.id)}>⧉</button>
                <button class="cep-mini cep-danger" title="Delete" on:click={() => removeColumn(col.id)}>✕</button>
              </span>
            </div>
          {/each}

          {#if columns.length === 0}
            <div class="cep-empty">
              No columns yet. Click <b>+ Add column</b> or <b>⟳ From data</b> to auto-detect them.
            </div>
          {/if}

          <div class="cep-hint">
            Transform runs per cell. Available variables: <code>value</code>, <code>row</code>,
            <code>index</code>, <code>helpers</code>. Example:
            <code>helpers.date(value)</code> · <code>helpers.round(value, 2)</code> ·
            <code>row.first_name + ' ' + row.last_name</code>
          </div>
        </div>

        <!-- Excel-like preview -->
        <div class="cep-preview">
          <div class="cep-preview-label">Preview (first {previewRows.length} row(s))</div>
          <div class="cep-grid-wrap">
            <table class="cep-grid">
              <thead>
                <tr class="cep-letters">
                  <th class="cep-corner"></th>
                  {#each previewCols as _c, i}
                    <th>{colLetter(i)}</th>
                  {/each}
                </tr>
                <tr class="cep-headers">
                  <th class="cep-rownum">1</th>
                  {#each previewCols as c}
                    <th>{c.header || ""}</th>
                  {/each}
                </tr>
              </thead>
              <tbody>
                {#each previewRows as row, r}
                  <tr>
                    <td class="cep-rownum">{r + 2}</td>
                    {#each previewCols as c}
                      <td>{cellValue(c, row, r)}</td>
                    {/each}
                  </tr>
                {/each}
                {#if previewRows.length === 0}
                  <tr>
                    <td class="cep-rownum">2</td>
                    <td class="cep-norows" colspan={previewCols.length || 1}>
                      No data available from the data provider.
                    </td>
                  </tr>
                {/if}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="cep-modal-foot">
        {#if toast}<span class="cep-foot-toast">{toast}</span>{/if}
        <div class="cep-spacer"></div>
        <button class="cep-btn cep-ghost cep-S" on:click={() => (open = false)}>Close</button>
        <button class="cep-btn cep-primary cep-S" on:click={exportCsv}>Export Csv</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .cep-root {
    display: inline-block;
    font-family: var(--font-sans, "Inter", system-ui, -apple-system, sans-serif);
  }
  .cep-actions {
    display: inline-flex;
    gap: 8px;
    align-items: center;
  }

  /* Buttons */
  .cep-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border: 1px solid transparent;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 600;
    line-height: 1;
    transition: background 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
    white-space: nowrap;
  }
  .cep-S {
    padding: 6px 10px;
    font-size: 12px;
  }
  .cep-M {
    padding: 9px 14px;
    font-size: 13px;
  }
  .cep-L {
    padding: 12px 18px;
    font-size: 15px;
  }
  .cep-primary {
    background: var(--spectrum-global-color-green-500, #16a34a);
    color: #fff;
  }
  .cep-primary:hover {
    background: var(--spectrum-global-color-green-600, #15803d);
  }
  .cep-ghost {
    background: var(--spectrum-global-color-gray-100, #f3f4f6);
    color: var(--spectrum-global-color-gray-800, #1f2937);
    border-color: var(--spectrum-global-color-gray-300, #d1d5db);
  }
  .cep-ghost:hover {
    background: var(--spectrum-global-color-gray-200, #e5e7eb);
  }

  .cep-toast {
    margin-top: 6px;
    font-size: 12px;
    color: var(--spectrum-global-color-gray-700, #374151);
  }

  /* Modal */
  .cep-overlay {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 999999;
    padding: 40px;
  }
  .cep-modal {
    background: #fff;
    color: #111827;
    width: min(900px, 92vw);
    max-height: 80vh;
    border-radius: 10px;
    display: flex;
    flex-direction: column;
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.28);
    overflow: hidden;
  }
  .cep-modal-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 18px;
    border-bottom: 1px solid #e5e7eb;
    background: linear-gradient(#f9fafb, #f3f4f6);
  }
  .cep-title strong {
    font-size: 15px;
  }
  .cep-sub {
    display: block;
    font-size: 12px;
    color: #6b7280;
    margin-top: 2px;
  }
  .cep-x {
    border: none;
    background: transparent;
    font-size: 22px;
    line-height: 1;
    cursor: pointer;
    color: #6b7280;
    padding: 4px 8px;
    border-radius: 6px;
  }
  .cep-x:hover {
    background: #e5e7eb;
    color: #111827;
  }

  .cep-toolbar {
    display: flex;
    gap: 8px;
    align-items: center;
    padding: 10px 18px;
    border-bottom: 1px solid #eef2f7;
    background: #fbfdff;
  }
  .cep-spacer {
    flex: 1;
  }

  .cep-body {
    padding: 14px 18px 18px;
    overflow: auto;
  }

  /* Config table */
  .cep-config-head,
  .cep-config-row {
    display: grid;
    grid-template-columns: 40px 1.1fr 1fr 1.6fr 120px;
    gap: 8px;
    align-items: center;
  }
  .cep-config-head {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #6b7280;
    padding: 4px 0 8px;
  }
  .cep-config-row {
    padding: 4px 0;
  }
  .cep-cell-idx {
    text-align: center;
    font-weight: 700;
    color: #16a34a;
    font-size: 12px;
  }
  .cep-input {
    width: 100%;
    box-sizing: border-box;
    padding: 7px 9px;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 13px;
    background: #fff;
    color: #111827;
  }
  .cep-input:focus {
    outline: none;
    border-color: #16a34a;
    box-shadow: 0 0 0 2px rgba(22, 163, 74, 0.15);
  }
  .cep-code {
    font-family: "SFMono-Regular", ui-monospace, Menlo, Consolas, monospace;
    font-size: 12px;
  }
  .cep-cell-ops {
    display: flex;
    gap: 3px;
    justify-content: center;
  }
  .cep-mini {
    border: 1px solid #e5e7eb;
    background: #f9fafb;
    border-radius: 5px;
    width: 26px;
    height: 26px;
    cursor: pointer;
    font-size: 11px;
    color: #374151;
  }
  .cep-mini:hover {
    background: #eef2f7;
  }
  .cep-danger {
    color: #dc2626;
  }
  .cep-danger:hover {
    background: #fee2e2;
  }

  .cep-empty {
    padding: 18px;
    text-align: center;
    color: #6b7280;
    border: 1px dashed #d1d5db;
    border-radius: 8px;
    margin: 8px 0;
    font-size: 13px;
  }
  .cep-hint {
    margin-top: 10px;
    font-size: 12px;
    color: #6b7280;
    line-height: 1.6;
  }
  .cep-hint code {
    background: #f3f4f6;
    padding: 1px 5px;
    border-radius: 4px;
    font-size: 11px;
  }

  /* Excel-like preview grid */
  .cep-preview {
    margin-top: 18px;
  }
  .cep-preview-label {
    font-size: 12px;
    color: #6b7280;
    margin-bottom: 6px;
  }
  .cep-grid-wrap {
    overflow: auto;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    max-height: 320px;
  }
  .cep-grid {
    border-collapse: collapse;
    font-size: 12px;
    min-width: 100%;
  }
  .cep-grid th,
  .cep-grid td {
    border: 1px solid #d7dde5;
    padding: 5px 9px;
    text-align: left;
    white-space: nowrap;
    background: #fff;
  }
  .cep-grid .cep-letters th {
    background: #f1f5f9;
    color: #64748b;
    text-align: center;
    font-weight: 600;
    position: sticky;
    top: 0;
    z-index: 2;
  }
  .cep-grid .cep-headers th {
    background: #ecfdf5;
    color: #065f46;
    font-weight: 700;
    position: sticky;
    top: 26px;
    z-index: 2;
  }
  .cep-rownum,
  .cep-corner {
    background: #f1f5f9 !important;
    color: #64748b;
    text-align: center;
    font-weight: 600;
    position: sticky;
    left: 0;
    z-index: 1;
  }
  .cep-corner {
    z-index: 3;
  }
  .cep-norows {
    color: #9ca3af;
    text-align: center;
    font-style: italic;
  }

  .cep-modal-foot {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 18px;
    border-top: 1px solid #e5e7eb;
    background: #f9fafb;
  }
  .cep-foot-toast {
    font-size: 12px;
    color: #16a34a;
    font-weight: 600;
  }
</style>
