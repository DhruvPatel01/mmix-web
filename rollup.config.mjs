import {nodeResolve} from "@rollup/plugin-node-resolve"
export default {
  input: "./editor.mjs",
  watch: true,
  output: {
    file: "./editor.js",
    format: "es"
  },
  plugins: [nodeResolve()]
}

