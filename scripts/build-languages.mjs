// Builds languages/ (Slate 0.26.0): CodeMirror's language list and one chunk per language, loaded
// by slate.js on demand. Run by npm run build (npm run build:languages on its own).
//
// The chunks must use the CodeMirror inside slate.js, not copies of their own: an editor
// refuses extensions made with another copy of @codemirror/state, and colours are looked up by
// @lezer/highlight's tags, which only match within one copy. So each shared package below is
// replaced by a small module that reads the one slate.js left on globalThis (code-languages.js).

import { build } from 'esbuild';
import { rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SHARED = ['@codemirror/state', '@codemirror/view', '@codemirror/language', '@lezer/common', '@lezer/highlight'];
const require = createRequire(resolve(root, 'package.json'));

const exportsOf = {};
for (const name of SHARED) {
  // The package's ESM build, from Slate's own node_modules.
  const entry = require.resolve(name).replace(/\.cjs$/, '.js');
  exportsOf[name] = Object.keys(await import(pathToFileURL(entry).href)).filter(key => key !== 'default');
}

const shared = {
  name: 'slate-shared-codemirror',
  setup(build) {
    const filter = new RegExp(`^(${SHARED.map(name => name.replace(/[/]/g, '\\/')).join('|')})$`);
    build.onResolve({ filter }, args => ({ path: args.path, namespace: 'slate-shared' }));
    build.onLoad({ filter: /.*/, namespace: 'slate-shared' }, args => ({
      contents: `const m = globalThis[Symbol.for('slate.codemirror')]?.[${JSON.stringify(args.path)}];\n`
        + `if (!m) throw new Error('Load slate.js before its languages.');\n`
        + exportsOf[args.path].map(key => `export const ${key} = m.${key};`).join('\n'),
      loader: 'js',
    }));
  },
};

rmSync(resolve(root, 'languages'), { recursive: true, force: true });
await build({
  entryPoints: [resolve(root, 'src/languages-entry.js')],
  bundle: true,
  format: 'esm',
  splitting: true,
  target: 'es2020',
  minify: true,
  legalComments: 'eof',
  outdir: resolve(root, 'languages'),
  entryNames: 'languages',
  chunkNames: 'chunks/[name]-[hash]',
  plugins: [shared],
  logLevel: 'warning',
});
console.log('Built languages/.');
