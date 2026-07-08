<script>
  import { getContext, onMount, afterUpdate, tick } from "svelte"

  // ---- Settings passed from the Budibase builder (schema.json keys) ----
  export let dataProvider
  export let buttonText = "Export Csv"
  export let filename = "export"
  export let delimiter = "comma"
  export let includeBom = true
  export let allowDesigner = true
  export let configKey = ""
  export let buttonSize = "M"
  export let allowPrintPreview = true
  export let printTitle = ""
  export let documentNumber = ""
  export let documentNumberLabel = "Document No."
  export let watermarkSource = ""
  export let watermarkOpacity = 0.12
  export let onExport

  // ---- Budibase runtime context ----
  const { styleable } = getContext("sdk")
  const component = getContext("component")

  // ---- Local state ----
  let open = false          // designer modal
  let printOpen = false     // print preview modal
  let columns = []          // [{ id, header, sourceField, transform, format, align, mergeCols, mergeRows }]
  let toast = ""            // small status message
  let loaded = false
  let printWrapEl           // bound to the print table's scroll wrapper
  let previewWrapEl         // bound to the designer preview's scroll wrapper
  let printFits = true
  let previewFits = true

  const uid = () => Math.random().toString(36).slice(2, 9)

  // Rows + schema exposed by the bound data provider. The setting accepts
  // either a Data Provider component or a Table component (both expose the
  // same "dataProvider" context shape in Budibase), and we defensively
  // unwrap a couple of other shapes too so either works without extra config.
  function extractRows(dp) {
    if (!dp) return []
    if (Array.isArray(dp)) return dp
    if (Array.isArray(dp.rows)) return dp.rows
    if (dp.rows && Array.isArray(dp.rows.value)) return dp.rows.value
    return []
  }
  function extractSchema(dp) {
    if (!dp) return {}
    if (dp.schema && typeof dp.schema === "object") return dp.schema
    if (dp.definition && dp.definition.schema) return dp.definition.schema
    return {}
  }

  $: rows = extractRows(dataProvider)
  $: providerSchema = extractSchema(dataProvider)
  $: tableLabel =
    (dataProvider && dataProvider.datasource && dataProvider.datasource.label) ||
    (dataProvider && dataProvider.datasource && dataProvider.datasource.tableId) ||
    (dataProvider && dataProvider.tableId) ||
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
    columns = detectedFields.map(f => newColumn(f, prettify(f)))
  }

  function newColumn(sourceField, header) {
    return {
      id: uid(),
      header: header || "",
      sourceField: sourceField || "",
      transform: "",
      format: "js",       // "js" | "sql"
      align: "left",      // "left" | "center" | "right"
      mergeCols: 1,        // merge N header cells to the right (Excel-like grouped header)
      mergeRows: false,    // merge consecutive identical values vertically in this column's body
    }
  }

  function prettify(key) {
    return String(key)
      .replace(/[_-]+/g, " ")
      .replace(/\b\w/g, c => c.toUpperCase())
      .trim()
  }

  // ---------- Column designer actions ----------
  function addColumn() {
    columns = [...columns, newColumn("", "Column " + (columns.length + 1))]
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
    columns = detectedFields.map(f => newColumn(f, prettify(f)))
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
    concat: (...args) => args.map(a => (a == null ? "" : String(a))).join(""),
    coalesce: (...args) => {
      for (const a of args) if (a !== null && a !== undefined && a !== "") return a
      return ""
    },
    like: (v, pattern) => {
      if (v == null) return false
      const re = new RegExp(
        "^" +
          String(pattern)
            .replace(/[.+^${}()|[\]\\]/g, "\\$&")
            .replace(/%/g, ".*")
            .replace(/_/g, ".") +
          "$",
        "i"
      )
      return re.test(String(v))
    },
    len: v => (v == null ? 0 : String(v).length),
    substring: (v, start, length) => {
      const s = v == null ? "" : String(v)
      const from = Math.max(0, (Number(start) || 1) - 1)
      return length != null ? s.substr(from, Number(length)) : s.substr(from)
    },
  }

  // ---------- Optional SQL-style transform (alternative to JavaScript) ----------
  // Supports: CASE WHEN..THEN..ELSE..END, arithmetic, comparisons, AND/OR/NOT,
  // IS [NOT] NULL, LIKE, || concatenation, and functions UPPER/LOWER/TRIM/ROUND/
  // CONCAT/COALESCE/IFNULL/LEN(GTH)/SUBSTR(ING)/ABS/NOW. `value` refers to the
  // current cell, plain identifiers resolve against the current row.
  function sqlTokenize(src) {
    const tokens = []
    let i = 0
    const n = src.length
    const isDigit = c => c >= "0" && c <= "9"
    const isIdentStart = c => /[A-Za-z_]/.test(c)
    const isIdentPart = c => /[A-Za-z0-9_]/.test(c)
    while (i < n) {
      const c = src[i]
      if (/\s/.test(c)) {
        i++
        continue
      }
      if (c === "'") {
        let j = i + 1
        let s = ""
        while (j < n && src[j] !== "'") {
          if (src[j] === "\\" && j + 1 < n) {
            s += src[j + 1]
            j += 2
          } else {
            s += src[j]
            j++
          }
        }
        tokens.push({ type: "string", value: s })
        i = j + 1
        continue
      }
      if (isDigit(c) || (c === "." && isDigit(src[i + 1]))) {
        let j = i
        while (j < n && /[0-9.]/.test(src[j])) j++
        tokens.push({ type: "number", value: src.slice(i, j) })
        i = j
        continue
      }
      if (isIdentStart(c)) {
        let j = i
        while (j < n && isIdentPart(src[j])) j++
        tokens.push({ type: "ident", value: src.slice(i, j) })
        i = j
        continue
      }
      const two = src.slice(i, i + 2)
      if (["<>", "!=", "<=", ">=", "||"].indexOf(two) !== -1) {
        tokens.push({ type: "op", value: two })
        i += 2
        continue
      }
      if ("()=<>+-*/,.".indexOf(c) !== -1) {
        tokens.push({ type: "op", value: c })
        i++
        continue
      }
      i++ // skip unknown character
    }
    return tokens
  }

  function sqlFunctionCall(name, args) {
    switch (name) {
      case "UPPER":
        return "helpers.upper(" + (args[0] || "value") + ")"
      case "LOWER":
        return "helpers.lower(" + (args[0] || "value") + ")"
      case "TRIM":
        return "helpers.trim(" + (args[0] || "value") + ")"
      case "ROUND":
        return "helpers.round(" + (args[0] || "value") + (args[1] ? ", " + args[1] : "") + ")"
      case "CONCAT":
        return "helpers.concat(" + args.join(", ") + ")"
      case "COALESCE":
      case "IFNULL":
        return "helpers.coalesce(" + args.join(", ") + ")"
      case "LEN":
      case "LENGTH":
        return "helpers.len(" + (args[0] || "value") + ")"
      case "SUBSTR":
      case "SUBSTRING":
        return "helpers.substring(" + args.join(", ") + ")"
      case "ABS":
        return "Math.abs(" + (args[0] || "value") + ")"
      case "NOW":
        return "new Date().toISOString()"
      default:
        throw new Error("Unknown function " + name)
    }
  }

  function sqlIdentifier(name, fields) {
    const upper = name.toUpperCase()
    if (upper === "VALUE") return "value"
    if (upper === "INDEX") return "index"
    if (upper === "ROW") return "row"
    return "row[" + JSON.stringify(name) + "]"
  }

  function sqlParse(tokens, fields) {
    let pos = 0
    const peek = () => tokens[pos]
    const next = () => tokens[pos++]
    const isKw = (t, kw) => t && t.type === "ident" && t.value.toUpperCase() === kw
    function expectOp(v) {
      const t = next()
      if (!t || t.value !== v) throw new Error("Expected '" + v + "'")
    }

    function parseExpr() {
      return parseOr()
    }
    function parseOr() {
      let left = parseAnd()
      while (isKw(peek(), "OR")) {
        next()
        left = "(" + left + " || " + parseAnd() + ")"
      }
      return left
    }
    function parseAnd() {
      let left = parseNot()
      while (isKw(peek(), "AND")) {
        next()
        left = "(" + left + " && " + parseNot() + ")"
      }
      return left
    }
    function parseNot() {
      if (isKw(peek(), "NOT")) {
        next()
        return "(!" + parseNot() + ")"
      }
      return parseComparison()
    }
    function parseComparison() {
      let left = parseConcat()
      const t = peek()
      if (t && isKw(t, "IS")) {
        next()
        let neg = false
        if (isKw(peek(), "NOT")) {
          next()
          neg = true
        }
        if (!isKw(peek(), "NULL")) throw new Error("Expected NULL after IS")
        next()
        return "(" + left + (neg ? " != null)" : " == null)")
      }
      if (t && isKw(t, "LIKE")) {
        next()
        return "helpers.like(" + left + ", " + parseConcat() + ")"
      }
      if (t && t.type === "op" && ["=", "<>", "!=", "<", "<=", ">", ">="].indexOf(t.value) !== -1) {
        next()
        const right = parseConcat()
        const op = t.value === "=" ? "==" : t.value === "<>" ? "!=" : t.value
        return "(" + left + " " + op + " " + right + ")"
      }
      return left
    }
    function parseConcat() {
      let left = parseAdditive()
      while (peek() && peek().type === "op" && peek().value === "||") {
        next()
        left = "helpers.concat(" + left + ", " + parseAdditive() + ")"
      }
      return left
    }
    function parseAdditive() {
      let left = parseMultiplicative()
      while (peek() && peek().type === "op" && (peek().value === "+" || peek().value === "-")) {
        const op = next().value
        left = "(" + left + " " + op + " " + parseMultiplicative() + ")"
      }
      return left
    }
    function parseMultiplicative() {
      let left = parseUnary()
      while (peek() && peek().type === "op" && (peek().value === "*" || peek().value === "/")) {
        const op = next().value
        left = "(" + left + " " + op + " " + parseUnary() + ")"
      }
      return left
    }
    function parseUnary() {
      if (peek() && peek().type === "op" && peek().value === "-") {
        next()
        return "(-" + parseUnary() + ")"
      }
      return parsePrimary()
    }
    function parseCase() {
      next() // CASE
      const whens = []
      while (isKw(peek(), "WHEN")) {
        next()
        const cond = parseExpr()
        if (!isKw(peek(), "THEN")) throw new Error("Expected THEN")
        next()
        whens.push([cond, parseExpr()])
      }
      let elseVal = "undefined"
      if (isKw(peek(), "ELSE")) {
        next()
        elseVal = parseExpr()
      }
      if (!isKw(peek(), "END")) throw new Error("Expected END")
      next()
      let expr = elseVal
      for (let i = whens.length - 1; i >= 0; i--) {
        expr = "(" + whens[i][0] + " ? " + whens[i][1] + " : " + expr + ")"
      }
      return expr
    }
    function parsePrimary() {
      const t = peek()
      if (!t) throw new Error("Unexpected end of expression")
      if (t.type === "number") {
        next()
        return t.value
      }
      if (t.type === "string") {
        next()
        return JSON.stringify(t.value)
      }
      if (t.type === "op" && t.value === "(") {
        next()
        const inner = parseExpr()
        expectOp(")")
        return "(" + inner + ")"
      }
      if (isKw(t, "CASE")) return parseCase()
      if (isKw(t, "NULL")) {
        next()
        return "null"
      }
      if (isKw(t, "TRUE")) {
        next()
        return "true"
      }
      if (isKw(t, "FALSE")) {
        next()
        return "false"
      }
      if (t.type === "ident") {
        next()
        if (peek() && peek().type === "op" && peek().value === "(") {
          next()
          const args = []
          if (!(peek() && peek().value === ")")) {
            args.push(parseExpr())
            while (peek() && peek().value === ",") {
              next()
              args.push(parseExpr())
            }
          }
          expectOp(")")
          return sqlFunctionCall(t.value.toUpperCase(), args)
        }
        return sqlIdentifier(t.value, fields)
      }
      throw new Error("Unexpected token near '" + t.value + "'")
    }

    const result = parseExpr()
    if (pos < tokens.length) throw new Error("Unexpected token near '" + tokens[pos].value + "'")
    return result
  }

  // Compile a per-column transform once (cached by format + body string).
  const transformCache = {}
  function compileTransform(body) {
    const key = "js::" + body
    if (transformCache[key]) return transformCache[key]
    const src = /\breturn\b/.test(body) ? body : "return (" + body + ")"
    let fn
    try {
      // eslint-disable-next-line no-new-func
      fn = new Function("value", "row", "index", "helpers", src)
    } catch (e) {
      fn = () => "#ERR:" + e.message
    }
    transformCache[key] = fn
    return fn
  }

  function compileSqlTransform(body) {
    const key = "sql::" + body
    if (transformCache[key]) return transformCache[key]
    let fn
    try {
      const jsExpr = sqlParse(sqlTokenize(body), detectedFields)
      // eslint-disable-next-line no-new-func
      fn = new Function("value", "row", "index", "helpers", "return (" + jsExpr + ")")
    } catch (e) {
      fn = () => "#ERR:" + e.message
    }
    transformCache[key] = fn
    return fn
  }

  function cellValue(col, row, index) {
    let value = col.sourceField ? row[col.sourceField] : undefined
    const body = col.transform && col.transform.trim()
    if (body) {
      try {
        const fn = col.format === "sql" ? compileSqlTransform(body) : compileTransform(body)
        value = fn(value, row, index, helpers)
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
  $: previewCols = columns.length ? columns : detectedFields.map(f => newColumn(f, prettify(f)))
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

  // ---------- Print preview: merge & center (Excel-like) ----------
  $: printCols = columns.length ? columns : detectedFields.map(f => newColumn(f, prettify(f)))

  // Group consecutive header cells per mergeCols into a colspan, and compute
  // rowspans for columns with "merge repeated" enabled (like merging a column
  // of identical values down its length in Excel).
  function buildPrintGrid() {
    const cols = printCols
    const headerCells = []
    let i = 0
    while (i < cols.length) {
      const span = Math.max(1, Math.min(Number(cols[i].mergeCols) || 1, cols.length - i))
      headerCells.push({ col: cols[i], colSpan: span })
      i += span
    }

    const dataRows = rows
    const values = dataRows.map((row, r) => cols.map(c => cellValue(c, row, r)))
    const rowSpan = dataRows.map(() => cols.map(() => 1))
    const skip = dataRows.map(() => cols.map(() => false))

    cols.forEach((c, ci) => {
      if (!c.mergeRows) return
      let start = 0
      while (start < dataRows.length) {
        let end = start + 1
        while (end < dataRows.length && values[end][ci] === values[start][ci]) end++
        rowSpan[start][ci] = end - start
        for (let k = start + 1; k < end; k++) skip[k][ci] = true
        start = end
      }
    })

    return { cols, headerCells, values, rowSpan, skip }
  }
  $: printGrid = printOpen ? buildPrintGrid() : null

  // "Fit to screen" layout: if the table's natural width fits the wrapper,
  // stretch it to 100%. If there are too many columns to fit, keep the
  // original (unshrunk) sizing and let the wrapper scroll horizontally
  // instead of squeezing every column.
  async function measureFit(el, setter) {
    if (!el) return
    await tick()
    const table = el.querySelector("table")
    if (!table) return
    // Measure natural width unconstrained, then compare to the wrapper.
    const prevWidth = table.style.width
    table.style.width = "max-content"
    const natural = table.scrollWidth
    table.style.width = prevWidth
    setter(natural <= el.clientWidth)
  }

  afterUpdate(() => {
    if (printOpen) measureFit(printWrapEl, v => (printFits = v))
    if (open) measureFit(previewWrapEl, v => (previewFits = v))
  })

  function openPrintPreview() {
    printOpen = true
  }
  function doPrint() {
    window.print()
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

    {#if allowPrintPreview}
      <button
        class="cep-btn cep-ghost cep-{buttonSize}"
        title="Print preview"
        on:click={openPrintPreview}
      >
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
          <path
            fill="currentColor"
            d="M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z"
          />
        </svg>
        <span>Print</span>
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
          {#each columns as col, i (col.id)}
            <div class="cep-config-card">
              <div class="cep-config-row1">
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

                <select class="cep-input cep-format" bind:value={col.format} title="Transform format">
                  <option value="js">JS</option>
                  <option value="sql">SQL</option>
                </select>

                <input
                  class="cep-input cep-code"
                  type="text"
                  placeholder={col.format === "sql"
                    ? "e.g. CASE WHEN value > 100 THEN 'High' ELSE 'Low' END"
                    : "e.g. value + ' บาท'   |   vars: value, row, index, helpers"}
                  bind:value={col.transform}
                />

                <span class="cep-cell-ops">
                  <button class="cep-mini" title="Move up" on:click={() => move(col.id, -1)}>▲</button>
                  <button class="cep-mini" title="Move down" on:click={() => move(col.id, 1)}>▼</button>
                  <button class="cep-mini" title="Duplicate" on:click={() => duplicateColumn(col.id)}>⧉</button>
                  <button class="cep-mini cep-danger" title="Delete" on:click={() => removeColumn(col.id)}>✕</button>
                </span>
              </div>

              <div class="cep-config-row2">
                <label class="cep-mini-label">
                  Align
                  <select class="cep-input cep-small" bind:value={col.align}>
                    <option value="left">Left</option>
                    <option value="center">Center</option>
                    <option value="right">Right</option>
                  </select>
                </label>
                <label class="cep-mini-label" title="Merge this header with the next N-1 columns, like Excel merge & center">
                  Merge header (cols)
                  <input
                    class="cep-input cep-small"
                    type="number"
                    min="1"
                    max={columns.length - i}
                    bind:value={col.mergeCols}
                  />
                </label>
                <label class="cep-mini-label cep-checkbox" title="Merge consecutive identical values down this column, like Excel merge & center">
                  <input type="checkbox" bind:checked={col.mergeRows} />
                  Merge repeated rows
                </label>
              </div>
            </div>
          {/each}

          {#if columns.length === 0}
            <div class="cep-empty">
              No columns yet. Click <b>+ Add column</b> or <b>⟳ From data</b> to auto-detect them.
            </div>
          {/if}

          <div class="cep-hint">
            Transform runs per cell. Available variables: <code>value</code>, <code>row</code>,
            <code>index</code>, <code>helpers</code>. Example (JS):
            <code>helpers.date(value)</code> · <code>helpers.round(value, 2)</code> ·
            <code>row.first_name + ' ' + row.last_name</code><br />
            Example (SQL): <code>CASE WHEN value &gt; 100 THEN 'High' ELSE 'Low' END</code> ·
            <code>UPPER(value)</code> · <code>ROUND(value, 2)</code> ·
            <code>first_name || ' ' || last_name</code><br />
            <b>Align</b> / <b>Merge</b> apply to the Print Preview sheet (Excel-like merge &amp; center),
            not the CSV file.
          </div>
        </div>

        <!-- Excel-like preview -->
        <div class="cep-preview">
          <div class="cep-preview-label">Preview (first {previewRows.length} row(s))</div>
          <div class="cep-grid-wrap" bind:this={previewWrapEl}>
            <table class="cep-grid" class:cep-fit={previewFits}>
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
                    <th style="text-align:{c.align || 'left'}">{c.header || ""}</th>
                  {/each}
                </tr>
              </thead>
              <tbody>
                {#each previewRows as row, r}
                  <tr>
                    <td class="cep-rownum">{r + 2}</td>
                    {#each previewCols as c}
                      <td style="text-align:{c.align || 'left'}">{cellValue(c, row, r)}</td>
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

{#if printOpen}
  <div class="cep-overlay cep-print-overlay" on:click|self={() => (printOpen = false)}>
    <div class="cep-print-panel">
      <div class="cep-print-toolbar">
        <strong>Print Preview</strong>
        <span class="cep-sub">{rows.length} row(s){tableLabel ? " · " + tableLabel : ""}</span>
        <div class="cep-spacer"></div>
        <button class="cep-btn cep-primary cep-S" on:click={doPrint}>🖨 Print</button>
        <button class="cep-btn cep-ghost cep-S" on:click={() => (printOpen = false)}>Close</button>
      </div>

      <div class="cep-print-scroll">
        <div class="cep-print-sheet">
          {#if watermarkSource}
            <img
              class="cep-watermark"
              src={watermarkSource}
              alt=""
              style="opacity:{watermarkOpacity}"
            />
          {/if}

          <div class="cep-print-head">
            {#if printTitle}<h1 class="cep-print-title">{printTitle}</h1>{/if}
            <div class="cep-print-meta">
              {#if documentNumber}
                <span class="cep-doc-number">{documentNumberLabel}: {documentNumber}</span>
              {/if}
              <span class="cep-print-date">{new Date().toLocaleDateString("th-TH")}</span>
            </div>
          </div>

          <div class="cep-print-table-wrap" bind:this={printWrapEl}>
            {#if printGrid}
              <table class="cep-print-table" class:cep-fit={printFits}>
                <thead>
                  <tr>
                    {#each printGrid.headerCells as hc}
                      <th colspan={hc.colSpan} style="text-align:{hc.col.align || 'left'}">
                        {hc.col.header || ""}
                      </th>
                    {/each}
                  </tr>
                </thead>
                <tbody>
                  {#each printGrid.values as rowVals, r}
                    <tr>
                      {#each printGrid.cols as c, ci}
                        {#if !printGrid.skip[r][ci]}
                          <td
                            rowspan={printGrid.rowSpan[r][ci]}
                            style="text-align:{c.align || 'left'}"
                          >
                            {rowVals[ci]}
                          </td>
                        {/if}
                      {/each}
                    </tr>
                  {/each}
                  {#if printGrid.values.length === 0}
                    <tr>
                      <td class="cep-norows" colspan={printGrid.cols.length || 1}>
                        No data available from the data provider.
                      </td>
                    </tr>
                  {/if}
                </tbody>
              </table>
            {/if}
          </div>
        </div>
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
    width: min(1100px, 96vw);
    max-height: 88vh;
    border-radius: 10px;
    display: flex;
    flex-direction: column;
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.28);
    overflow: hidden;
  }

  @media (max-width: 720px) {
    .cep-config-row1 {
      grid-template-columns: 1fr;
    }
    .cep-cell-ops {
      justify-content: flex-start;
    }
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

  /* Config cards */
  .cep-config-card {
    border: 1px solid #eef2f7;
    border-radius: 8px;
    padding: 8px 10px;
    margin-bottom: 6px;
    background: #fbfdff;
  }
  .cep-config-row1 {
    display: grid;
    grid-template-columns: 28px 1.1fr 1fr 70px 1.6fr 120px;
    gap: 8px;
    align-items: center;
  }
  .cep-config-row2 {
    display: flex;
    flex-wrap: wrap;
    gap: 14px;
    align-items: center;
    margin-top: 6px;
    padding-top: 6px;
    border-top: 1px dashed #e5e7eb;
  }
  .cep-mini-label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }
  .cep-mini-label.cep-checkbox {
    text-transform: none;
    font-size: 12px;
    color: #374151;
  }
  .cep-small {
    width: auto;
    min-width: 72px;
    padding: 5px 7px;
  }
  .cep-format {
    text-align: center;
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
  /* Fit-to-screen: when the table's natural width fits the wrapper, stretch
     it evenly. Otherwise (too many columns) keep natural sizing and let
     .cep-grid-wrap / .cep-print-table-wrap scroll horizontally instead. */
  .cep-grid.cep-fit {
    width: 100%;
    table-layout: fixed;
  }
  .cep-grid.cep-fit th,
  .cep-grid.cep-fit td {
    white-space: normal;
    word-break: break-word;
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

  /* ---------- Print preview ---------- */
  .cep-print-overlay {
    z-index: 1000000;
    padding: 24px;
  }
  .cep-print-panel {
    background: #e5e7eb;
    width: min(1400px, 98vw);
    max-height: 94vh;
    border-radius: 10px;
    display: flex;
    flex-direction: column;
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.28);
    overflow: hidden;
  }
  .cep-print-toolbar {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 18px;
    background: #fff;
    border-bottom: 1px solid #e5e7eb;
    color: #111827;
  }
  .cep-print-scroll {
    flex: 1;
    overflow: auto;
    padding: 24px;
    display: flex;
    justify-content: center;
  }
  .cep-print-sheet {
    position: relative;
    background: #fff;
    color: #111827;
    width: 100%;
    max-width: 1200px;
    padding: 28px 32px;
    border-radius: 4px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.12);
    overflow: hidden;
  }
  .cep-watermark {
    position: absolute;
    top: 50%;
    left: 50%;
    max-width: 70%;
    max-height: 70%;
    transform: translate(-50%, -50%) rotate(-25deg);
    pointer-events: none;
    z-index: 0;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .cep-print-head {
    position: relative;
    z-index: 1;
    margin-bottom: 14px;
  }
  .cep-print-title {
    font-size: 20px;
    margin: 0 0 6px;
  }
  .cep-print-meta {
    display: flex;
    justify-content: space-between;
    font-size: 12px;
    color: #4b5563;
  }
  .cep-doc-number {
    font-weight: 600;
    color: #111827;
  }
  .cep-print-table-wrap {
    position: relative;
    z-index: 1;
    overflow-x: auto;
  }
  .cep-print-table {
    border-collapse: collapse;
    width: max-content;
    min-width: 100%;
    font-size: 13px;
  }
  .cep-print-table.cep-fit {
    width: 100%;
    table-layout: fixed;
  }
  .cep-print-table.cep-fit th,
  .cep-print-table.cep-fit td {
    white-space: normal;
    word-break: break-word;
  }
  .cep-print-table th,
  .cep-print-table td {
    border: 1px solid #94a3b8;
    padding: 6px 10px;
    white-space: nowrap;
  }
  .cep-print-table thead th {
    background: #f1f5f9;
    font-weight: 700;
  }

  @media print {
    .cep-root,
    .cep-toast,
    .cep-overlay:not(.cep-print-overlay) {
      display: none !important;
    }
    .cep-print-overlay {
      position: static;
      background: none;
      padding: 0;
    }
    .cep-print-toolbar {
      display: none !important;
    }
    .cep-print-panel {
      width: auto;
      max-height: none;
      box-shadow: none;
      background: none;
      overflow: visible;
    }
    .cep-print-scroll {
      overflow: visible;
      padding: 0;
    }
    .cep-print-sheet {
      box-shadow: none;
      max-width: none;
      overflow: visible;
    }
    .cep-print-table-wrap {
      overflow: visible;
    }
    .cep-print-table {
      width: 100% !important;
      table-layout: fixed !important;
    }
    .cep-print-table th,
    .cep-print-table td {
      white-space: normal !important;
      word-break: break-word;
    }
  }
</style>
