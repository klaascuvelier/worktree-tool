import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/cli.ts', 'src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  minify: false,
  target: 'node22',
  platform: 'node',
  esbuildOptions(options) {
    options.conditions = ['node'];
  },
  banner: {
    js: '#!/usr/bin/env node',
  },
});
