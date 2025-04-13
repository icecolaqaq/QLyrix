import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import Icons from 'unplugin-icons/vite'
import IconsResolver from 'unplugin-icons/resolver'
import wasm from 'vite-plugin-wasm'
import vueJsx from "@vitejs/plugin-vue-jsx";

const webComponents = ['widget-qrcode']

export default defineConfig({
  main: {
    plugins: [],
    build: {
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    build: {
      rollupOptions: {
        input: {
          main: resolve('src/renderer/index.html'),
        },
      }
    },
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer'),
      }
    },
    plugins: [
      vue({
        template: {
          compilerOptions: {
            isCustomElement: (tag) => webComponents.includes(tag)
          }
        }
      }),
      wasm(),
      vueJsx(),
      AutoImport({
        resolvers: [
          ElementPlusResolver(),
          IconsResolver({
            prefix: 'Icon',
          }),
        ],

      }),
      Components({
        resolvers: [
          ElementPlusResolver(),
          IconsResolver({
            enabledCollections: ['ep'],
          }),
        ],
      }),
      Icons({
        autoInstall: true,
      }),
    ]
  }

  
})
