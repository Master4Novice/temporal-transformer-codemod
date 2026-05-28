import typescript from '@rollup/plugin-typescript';
import dts from 'rollup-plugin-dts';
import copy from 'rollup-plugin-copy';
import resolve from '@rollup/plugin-node-resolve';

// Externals: never bundle node:* builtins or third-party deps. jscodeshift is
// declared via two specifier forms because the bin script references the
// Runner submodule directly.
const external = [
  'jscodeshift',
  'jscodeshift/src/Runner.js',
  'node:fs',
  'node:fs/promises',
  'node:path',
  'node:os',
  'node:url',
  'node:module',
];

// Reusable TS plugin config. We disable declaration emission here because
// the dts() step below emits a single bundled .d.ts; per-file declarations
// would otherwise emit to paths the rollup-typescript plugin can't resolve.
const tsPlugin = () =>
  typescript({
    tsconfig: 'tsconfig.json',
    declaration: false,
    declarationDir: undefined,
  });

export default [
  // 1. dist/index.js — the bundled programmatic entry (translateMomentFormat,
  //    transformer, bumpPackageJson, findPackageJsons, etc.)
  {
    input: 'src/index.ts',
    output: { file: 'dist/index.js', format: 'esm', sourcemap: true },
    external,
    plugins: [resolve(), tsPlugin()],
  },

  // 2. dist/codemod.js — kept as a standalone file because jscodeshift's
  //    Runner.run() expects a file path (it spawns workers that load the
  //    transformer module from disk).
  {
    input: 'src/codemod.ts',
    output: { file: 'dist/codemod.js', format: 'esm', sourcemap: true },
    external,
    plugins: [resolve(), tsPlugin()],
  },

  // 3. dist/updateDeps.js — kept standalone because the bin script
  //    `await import()`s it at runtime from the package root.
  {
    input: 'src/updateDeps.ts',
    output: { file: 'dist/updateDeps.js', format: 'esm', sourcemap: true },
    external,
    plugins: [resolve(), tsPlugin()],
  },

  // 4. dist/index.d.ts — bundled types for the programmatic API.
  //    The copy plugin is attached here so it fires last (after every JS
  //    bundle and the dts emit have written to disk).
  {
    input: 'src/index.ts',
    output: { file: 'dist/index.d.ts', format: 'es' },
    plugins: [
      dts({ tsconfig: 'tsconfig.json' }),
      copy({
        targets: [
          // Bin script: rewrite the dist/* path resolution to be relative to
          // the published package root (which IS dist/ after publishConfig.directory).
          {
            src: 'bin/temporal-transformer-codemod.mjs',
            dest: 'dist/bin',
            transform: (contents) => {
              return contents
                .toString()
                .replace(/resolve\(packageRoot,\s*'dist\/codemod\.js'\)/g, "resolve(packageRoot, 'codemod.js')")
                .replace(/resolve\(packageRoot,\s*'dist\/updateDeps\.js'\)/g, "resolve(packageRoot, 'updateDeps.js')");
            },
          },
          { src: ['README.md', 'LICENSE', 'SECURITY.md'], dest: 'dist' },
          // package.json: strip dev fields, adjust paths so they resolve from
          // inside dist/ (which is what consumers `npm install`).
          {
            src: 'package.json',
            dest: 'dist',
            transform: (contents) => {
              const pkg = JSON.parse(contents.toString());
              pkg.main = './index.js';
              pkg.types = './index.d.ts';
              pkg.bin = { 'temporal-transformer-codemod': './bin/temporal-transformer-codemod.mjs' };
              delete pkg.scripts;
              delete pkg.devDependencies;
              delete pkg.publishConfig;
              delete pkg.gitHead;
              return JSON.stringify(pkg, null, 2);
            },
          },
        ],
      }),
    ],
  },
];
