import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { fitnessChatDevPlugin } from './scripts/vite-fitness-api-plugin.js'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  if (env.OPENAI_API_KEY) {
    process.env.OPENAI_API_KEY = env.OPENAI_API_KEY
  }

  if (env.OPENAI_MODEL) {
    process.env.OPENAI_MODEL = env.OPENAI_MODEL
  }

  if (env.OPENAI_BASE_URL) {
    process.env.OPENAI_BASE_URL = env.OPENAI_BASE_URL
  }

  if (env.FITGUIDE_COACH_DEMO) {
    process.env.FITGUIDE_COACH_DEMO = env.FITGUIDE_COACH_DEMO
  }

  return {
    plugins: [react(), fitnessChatDevPlugin(env)],
    server: {
      port: 5173,
    },
  }
})
