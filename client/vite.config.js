import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteStaticCopy } from 'vite-plugin-static-copy'
import path from 'path'

function globalVirtualPlugin() {
  const globals = { mailtrainConfig: 'window.mailtrainConfig', csrfToken: 'window.csrfToken' };
  return {
    name: 'virtual-globals',
    resolveId(id) {
      if (id in globals) return `\0virtual:${id}`;
    },
    load(id) {
      const name = id.replace('\0virtual:', '');
      if (name in globals) return `export default ${globals[name]};`;
    }
  };
}

function loggerPlugin() {
  return {
    name: "requestLogger",
    configureServer(server) {
      return () => {
        server.middlewares.use((req, res, next) => {
          console.log(`[${new Date().toISOString()}] Vite ${req.method} ${req.url}`);
          next();
        });
      };
    },
  };
}

// Returns the relative path to the package installation directory (e.g. "../node_modules/@fortawesome/fontawesome-free")
// Works whether the package is in client/node_modules or root node_modules (npm link, hoisting, etc.)
function resolvePackagePath(packageName) {
  try {
    const pkgJson = require.resolve(packageName + '/package.json', { paths: [path.resolve(__dirname, 'node_modules'), path.resolve(__dirname, '../node_modules')] });
    return path.relative(__dirname, path.dirname(pkgJson));
  } catch (err) {
    console.error(`Failed to resolve package ${packageName}:`, err);
    throw err;
  }
}

// Returns the absolute path to the node_modules directory that contains packageName.
// Used e.g. as a Sass loadPath so SCSS can import packages without hardcoded relative paths.
function resolveNodeModulesDir(packageName) {
  const pkgAbsDir = path.resolve(__dirname, resolvePackagePath(packageName));
  // For scoped packages (@org/name) go up 2 levels, otherwise 1
  const depth = packageName.split('/').length;
  let dir = pkgAbsDir;
  for (let i = 0; i < depth; i++) dir = path.dirname(dir);
  return dir;
}

// Computes the correct stripBase value for viteStaticCopy from a src path.
// stripBase = number of path segments to strip so that only the last component (file or directory) remains.
// Works whether the package is in client/node_modules (e.g. "node_modules/pkg/dist/file.js")
// or root node_modules (e.g. "../node_modules/pkg/dist/file.js").
function computeStripBase(srcPath) {
  return path.normalize(srcPath).split(path.sep).length - 1;
} 

export default defineConfig({
  define: {
    "import.meta.env.BUILD_DATE": JSON.stringify(new Date().toISOString())
  },
  base: '/client/',
  plugins: [
    globalVirtualPlugin(),
    loggerPlugin(),
    react({
      babel: {
        plugins: [
          ['@babel/plugin-proposal-decorators', { version: 'legacy' }],
          ['@babel/plugin-proposal-class-properties', { loose: true }],
          ['@babel/plugin-proposal-private-methods', { loose: true }],
          ['@babel/plugin-proposal-private-property-in-object', { loose: true }],
        ]
      }
    }),
    viteStaticCopy({
      targets: [
        {
          src: resolvePackagePath('jquery') + '/dist/jquery.min.js',
          dest: '',
          rename: { stripBase: computeStripBase(resolvePackagePath('jquery') + '/dist/jquery.min.js') }
        },
        {
          src: resolvePackagePath('@popperjs/core') + '/dist/umd/popper.min.js',
          dest: '',
          rename: { stripBase: computeStripBase(resolvePackagePath('@popperjs/core') + '/dist/umd/popper.min.js') }
        },
        {
          src: resolvePackagePath('bootstrap') + '/dist/js/bootstrap.min.js',
          dest: '',
          rename: { stripBase: computeStripBase(resolvePackagePath('bootstrap') + '/dist/js/bootstrap.min.js') }
        },
        {
          src: resolvePackagePath('@coreui/coreui') + '/dist/js/coreui.min.js',
          dest: '',
          rename: { stripBase: computeStripBase(resolvePackagePath('@coreui/coreui') + '/dist/js/coreui.min.js') }
        },
        {
          src: resolvePackagePath('@fortawesome/fontawesome-free') + '/webfonts',
          dest: '',
          rename: { stripBase: computeStripBase(resolvePackagePath('@fortawesome/fontawesome-free') + '/webfonts') - 1 } // Keep the 'webfonts' directory in the destination path since FontAwesome CSS expects it (e.g. "../webfonts/fa-solid-900.woff2")
        }
      ]
    })
  ],
  resolve: {
    alias: {
      'mailtrain-shared': path.resolve(__dirname, '../shared'),
      'react-virtualized': path.resolve(__dirname, 'node_modules/react-sortable-tree/node_modules/react-virtualized/dist/commonjs/index.js'),
      // All jQuery imports (including plugins like DataTables) must use the
      // global instance loaded via <script> tag so plugins register correctly.
      'jquery': path.resolve(__dirname, 'src/lib/jquery-global.js')
    }
  },
  optimizeDeps: {
    exclude: ['mailtrainConfig', 'csrfToken']
  },
  css: {
    preprocessorOptions: {
      scss: {
        silenceDeprecations: ['legacy-js-api', 'import', 'global-builtin', 'color-functions', 'if-function']
      }
    }
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        root: 'src/root.jsx',
        'mosaico-root': 'src/lib/sandboxed-mosaico-root.jsx',
        'ckeditor-root': 'src/lib/sandboxed-ckeditor-root.jsx',
        'grapesjs-root': 'src/lib/sandboxed-grapesjs-root.jsx',
        'codeeditor-root': 'src/lib/sandboxed-codeeditor-root.jsx'
      },
      output: {
        entryFileNames: '[name].js',
        assetFileNames: (assetInfo) => {
          if (/\.css$/.test(assetInfo.name)) {
            // Keep the main entry CSS as mailtrain.css (expected by server/views/layout.hbs)
            if (assetInfo.name === 'root.css') return 'mailtrain.css';
            return '[name].css';
          }
          return 'assets/[name][extname]';
        }
      }
    }
  },
  server: {
    port: 8080,
    proxy: {
      '/api': 'http://localhost:3000',
      '/rest': 'http://localhost:3000',
      '/static': 'http://localhost:3000'
    }
  }
})
