import react from '@vitejs/plugin-react'
import {defineConfig} from 'vite'

// Vite configuration for The Way Home
export default defineConfig({
  plugins: [react()],
  base: '/',
})