// Ajouter 'mineraux' ici (et ses groupes) suffira pour ouvrir une nouvelle catégorie.
export const CATEGORIES = ['faune', 'flore'] as const
export type Categorie = (typeof CATEGORIES)[number]

export const LIBELLES: Record<Categorie, string> = { faune: 'Faune', flore: 'Flore' }

export const GROUPES: Record<Categorie, string[]> = {
  faune: ['Oiseaux', 'Insectes', 'Arachnides', 'Mammifères', 'Reptiles', 'Amphibiens', 'Poissons', 'Autres'],
  flore: ['Fleurs', 'Plantes', 'Champignons', 'Autres'],
}

const CLASSES_FAUNE: Record<string, string> = {
  Aves: 'Oiseaux',
  Insecta: 'Insectes',
  Arachnida: 'Arachnides',
  Mammalia: 'Mammifères',
  // GBIF éclate les reptiles en plusieurs classes.
  Reptilia: 'Reptiles',
  Squamata: 'Reptiles',
  Testudines: 'Reptiles',
  Crocodylia: 'Reptiles',
  Amphibia: 'Amphibiens',
  Actinopterygii: 'Poissons',
  Chondrichthyes: 'Poissons',
}

export function classerDepuisGbif(c: { kingdom?: string; class?: string }): { categorie: Categorie; groupe: string } | null {
  if (c.kingdom === 'Animalia') return { categorie: 'faune', groupe: CLASSES_FAUNE[c.class ?? ''] ?? 'Autres' }
  // Champignons classés en flore, comme sur l'ancien site.
  if (c.kingdom === 'Fungi') return { categorie: 'flore', groupe: 'Champignons' }
  if (c.kingdom === 'Plantae') {
    const fleur = c.class === 'Magnoliopsida' || c.class === 'Liliopsida'
    return { categorie: 'flore', groupe: fleur ? 'Fleurs' : 'Plantes' }
  }
  return null
}

export function estCategorie(v: unknown): v is Categorie {
  return CATEGORIES.includes(v as Categorie)
}
