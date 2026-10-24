import type { ImageMetadata } from 'astro'

/** Chemins "/src/content/especes/<categorie>/<slug>/<fichier>" → Map "<categorie>/<slug>" → images triées par nom. */
export function regrouperPhotos(modules: Record<string, ImageMetadata>): Map<string, ImageMetadata[]> {
  const groupes = new Map<string, { nom: string; img: ImageMetadata }[]>()
  for (const [chemin, img] of Object.entries(modules)) {
    const m = chemin.match(/especes\/([^/]+\/[^/]+)\/([^/]+)$/)
    if (!m) continue
    const liste = groupes.get(m[1]) ?? []
    liste.push({ nom: m[2], img })
    groupes.set(m[1], liste)
  }
  return new Map([...groupes].map(([cle, l]) => [cle, l.sort((a, b) => a.nom.localeCompare(b.nom)).map((p) => p.img)]))
}
