// Garde-fou : l'admin locale ne doit jamais se retrouver dans le site publié.
import { readdirSync } from 'node:fs'
import { join } from 'node:path'

const fuites = readdirSync('dist', { recursive: true }).filter((p) => /admin/i.test(p))
if (fuites.length) {
  for (const p of fuites) console.error(`Fuite admin : ${join('dist', p)}`)
  process.exit(1)
}
console.log('verifier-build : aucune trace de l’admin dans dist/')
