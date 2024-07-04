import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  dts: true,
  format: ['esm'],
  sourcemap: true,
  minify: true,
  clean: true,
  external: ["solid-js", "zod"],
  esbuildOptions(options) {
    options.jsx = 'preserve'
    options.jsxImportSource = 'solid-js'
  },
})
