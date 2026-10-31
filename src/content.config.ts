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
    positionLieu: z.tuple([z.number(), z.number()]).optional(),
    gbifKey: z.number().optional(),
    dateObservation: z.coerce.date().optional(),
    taille: z.string().optional(),
    poids: z.string().optional(),
    habitat: z.string().optional(),
    floraison: z.string().optional(),
    regime: z.string().optional(),
    statutUicn: z.enum(['LC', 'NT', 'VU', 'EN', 'CR', 'EW', 'EX', 'DD', 'NE']).optional(),
    photos: z.record(z.string(), z.object({
      legende: z.string().optional(),
      date: z.coerce.date().optional(),
      lieu: z.string().optional(),
    })).optional(),
    ordre: z.array(z.string()).optional(),
  }),
})

export const collections = { especes }
