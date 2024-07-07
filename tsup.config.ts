import { defineConfig } from "tsup";
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

export default defineConfig((options) => ({
  entry: ["src/index.ts"],
  dts: true,
  format: ["esm"],
  sourcemap: true,
  minify: true,
  clean: true,
  external: ["solid-js", "zod"],
  esbuildOptions(options) {
    options.jsx = "preserve";
    options.jsxImportSource = "solid-js";
  },
  onSuccess: async () => {
    try {
      execSync('npm run test', { stdio: 'inherit', cwd: __dirname });
    } catch (error) {
      console.error('Tests failed. Removing dist directory.');
      const distPath = path.join(__dirname, 'dist');
      if (fs.existsSync(distPath)) {
        fs.rmSync(distPath, { recursive: true, force: true });
      }
      if (!options.watch) {
        process.exit(1);
      }
    }
  },
}));
