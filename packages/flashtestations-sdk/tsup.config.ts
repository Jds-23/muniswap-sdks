import { readFileSync } from 'node:fs'
import { defineConfig } from 'tsup'

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'))

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    cli: 'src/cli/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  treeshake: true,
  splitting: false,
  minify: false,
  target: 'es2022',
  define: {
    __VERSION__: JSON.stringify(pkg.version),
  },
})
