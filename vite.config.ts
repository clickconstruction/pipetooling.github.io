import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { copyFileSync } from 'fs'
import { join } from 'path'

// Copy index.html to 404.html so GitHub Pages serves the SPA for any path (e.g. /dashboard refresh)
function copy404Plugin() {
  return {
    name: 'copy-404',
    closeBundle() {
      const outDir = join(process.cwd(), 'dist')
      copyFileSync(join(outDir, 'index.html'), join(outDir, '404.html'))
    },
  }
}

export default defineConfig({
  plugins: [react(), copy404Plugin()],
  base: '/',
})
