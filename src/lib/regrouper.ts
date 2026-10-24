import type { ImageMetadata } from 'astro'

export type Photo = { nom: string; image: ImageMetadata }

/** Chemins "/src/content/especes/<categorie>/<slug>/<fichier>" → Map "<categorie>/<slug>" → photos triées par nom. */
export function regrouperPhotos(modules: Record<string, ImageMetadata>): Map<string, Photo[]> {
  const groupes = new Map<string, Photo[]>()
  for (const [chemin, image] of Object.entries(modules)) {
    const m = chemin.match(/especes\/([^/]+\/[^/]+)\/([^/]+)$/)
    if (!m) continue
    const liste = groupes.get(m[1]) ?? []
    liste.push({ nom: m[2], image })
    groupes.set(m[1], liste)
  }
  return new Map([...groupes].map(([cle, l]) => [cle, l.sort((a, b) => a.nom.localeCompare(b.nom))]))
}
