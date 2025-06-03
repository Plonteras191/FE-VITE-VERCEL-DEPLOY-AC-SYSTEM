import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_APP_BASE_URL || '/FE-VITE-VERCEL-DEPLOY-AC-SYSTEM',
})
