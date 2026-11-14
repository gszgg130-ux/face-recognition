import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

const faceApiProxy = {
  '/api': {
    target: process.env.FACE_API_URL || 'http://127.0.0.1:5000',
    changeOrigin: true,
  },
}

const useHttps = process.env.HTTPS !== '0'

export default defineConfig({
  plugins: [react(), tailwindcss(), ...(useHttps ? [basicSsl({ name: 'tdb-face-pay' })] : [])],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: Number(process.env.PORT || 8443),
    strictPort: true,
    proxy: faceApiProxy,
  },
  preview: {
    host: '0.0.0.0',
    port: Number(process.env.PORT || 8443),
    strictPort: true,
    proxy: faceApiProxy,
  },
})
