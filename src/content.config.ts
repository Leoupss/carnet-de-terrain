import { defineCollection } from 'astro:content'
import { glob } from 'astro/loaders'
import { z } from 'astro/zod'
import { GROUPES } from './lib/categories'

const tousGroupes = [...new Set(Object.values(GROUPES).flat())] as [string, ...string[]]

const especes = defineCollection({
  loader: glob({
    pattern: '**/fiche.md',
    base: './src/content/especes',
    // id = "faune/vulpes-vulpes"
    generateId: ({ entry }) => entry.replace(/\\/g, '/').replace(/\/fiche\.md$/, ''),
  }),
  schema: z.object({
    nomScientifique: z.string().min(1),
    nomCommun: z.string().min(1),
    groupe: z.enum(tousGroupes),
    ajoute: z.coerce.date(),
    lieu: z.string().optional(),
    coordonnees: z.tuple([z.number(), z.number()]).optional(),
    gbifKey: z.number().optional(),
  }),
})

export const collections = { especes }
