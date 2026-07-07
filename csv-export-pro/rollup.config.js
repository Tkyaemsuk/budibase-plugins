import commonjs from "@rollup/plugin-commonjs"
import resolve from "@rollup/plugin-node-resolve"
import svelte from "rollup-plugin-svelte"
import { terser } from "rollup-plugin-terser"
import postcss from "rollup-plugin-postcss"
import json from "@rollup/plugin-json"
import nodePolyfills from "rollup-plugin-polyfill-node"
import fs from "fs"
import crypto from "crypto"
import tar from "tar"

const pkg = JSON.parse(fs.readFileSync("./package.json", "utf8"))

const ignoredWarnings = [
  "unused-export-let",
  "css-unused-selector",
  "module-script-reactive-declaration",
  "a11y-no-onchange",
  "a11y-click-events-have-key-events",
  "a11y-no-static-element-interactions",
]

const clean = () => ({
  buildStart() {
    const dist = "./dist/"
    if (fs.existsSync(dist)) {
      fs.readdirSync(dist).forEach(path => {
        if (path.endsWith(".tar.gz")) fs.unlinkSync(dist + path)
      })
    }
  },
})

const hash = () => ({
  writeBundle() {
    const fileBuffer = fs.readFileSync("dist/plugin.min.js")
    const hashSum = crypto.createHash("sha1")
    hashSum.update(fileBuffer)
    const hex = hashSum.digest("hex")
    const schema = JSON.parse(fs.readFileSync("./schema.json", "utf8"))
    const newSchema = { ...schema, hash: hex, version: pkg.version }
    fs.writeFileSync("./dist/schema.json", JSON.stringify(newSchema, null, 2))
    fs.copyFileSync("./package.json", "./dist/package.json")
  },
})

const bundle = () => ({
  async writeBundle() {
    const bundleName = `${pkg.name}-${pkg.version}.tar.gz`
    return tar
      .c({ gzip: true, cwd: "dist" }, [
        "plugin.min.js",
        "schema.json",
        "package.json",
      ])
      .pipe(fs.createWriteStream(`dist/${bundleName}`))
  },
})

export default {
  input: "index.js",
  // Budibase 3.4.1's client is Svelte 3 and exposes its runtime as the globals
  // `svelte` and `svelte_internal`. We keep these external and map to those exact
  // global names so the plugin shares the host runtime (this is what makes context,
  // props and mounting work). Bundling our own Svelte would break context sharing.
  external: ["svelte", "svelte/internal"],
  output: {
    sourcemap: process.env.ROLLUP_WATCH ? "inline" : false,
    format: "iife",
    file: "dist/plugin.min.js",
    name: "plugin",
    globals: {
      svelte: "svelte",
      "svelte/internal": "svelte_internal",
    },
  },
  plugins: [
    clean(),
    svelte({
      emitCss: true,
      onwarn: (warning, handler) => {
        if (!ignoredWarnings.includes(warning.code)) handler(warning)
      },
    }),
    postcss(),
    commonjs(),
    nodePolyfills(),
    resolve({
      preferBuiltins: true,
      browser: true,
      dedupe: ["svelte"],
    }),
    json(),
    terser(),
    hash(),
    bundle(),
  ],
}
