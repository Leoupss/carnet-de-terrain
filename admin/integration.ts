import type { AstroIntegration } from 'astro'
import { fileURLToPath } from 'node:url'
import { creerMiddleware } from './api'

/** L'admin n'existe que pendant `astro dev` : le hook astro:server:setup ne tourne jamais au build. */
export function integrationAdmin(): AstroIntegration {
  return {
    name: 'carnet-admin',
    hooks: {
      'astro:server:setup': ({ server, logger }) => {
        const projet = fileURLToPath(new URL('..', import.meta.url))
        const racine = fileURLToPath(new URL('../src/content/especes', import.meta.url))
        server.middlewares.use('/admin', creerMiddleware({ racine, projet }))
        logger.info('Admin locale : http://localhost:4321/admin/')
      },
    },
  }
}
