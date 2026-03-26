import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import { nodeResolve } from "@rollup/plugin-node-resolve";

const config = {
  input: "src/index.js",
  output: {
    file: "dist/index.js",
    format: "cjs",
    sourcemap: true,
  },
  plugins: [commonjs(), json(), nodeResolve({ preferBuiltins: true })],
};

export default config;
