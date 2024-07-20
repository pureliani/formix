import { defineConfig } from "vitest/config";
import solidPlugin from 'vite-plugin-solid';

export default defineConfig({
  plugins: [solidPlugin()],
  test: {
    coverage: {
      provider: "v8",
    },
    environment: 'jsdom',
    setupFiles: ['./vitest-setup.ts']
  },
});
