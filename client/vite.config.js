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
          src: 'node_modules/jquery/dist/jquery.min.js',
          dest: '',
          rename: { stripBase: 3 }
        },
        {
          src: 'node_modules/@popperjs/core/dist/umd/popper.min.js',
          dest: '',
          rename: { stripBase: 5 }
        },
        {
          src: 'node_modules/bootstrap/dist/js/bootstrap.min.js',
          dest: '',
          rename: { stripBase: 4 } 
        },
        {
          src: 'node_modules/@coreui/coreui/dist/js/coreui.min.js',
          dest: '',
          rename: { stripBase: 5 }
        },
        {
          src: 'node_modules/@fortawesome/fontawesome-free/webfonts',
          dest: '',
          rename: { stripBase: 3 }
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
          if (/\.css$/.test(assetInfo.name)) return 'mailtrain.css';
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
