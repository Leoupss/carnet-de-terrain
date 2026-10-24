import { defineConfig } from 'astro/config'
import { integrationAdmin } from './admin/integration.ts'

export default defineConfig({
  integrations: [integrationAdmin()],
})
