export type PointGlobe = {
  nom: string
  position: [number, number]
  especes: { nom: string; sci: string; url: string }[]
}

type EspeceLieu = {
  categorie: string
  slug: string
  data: { nomCommun: string; nomScientifique: string; lieu?: string; coordonnees?: [number, number]; positionLieu?: [number, number] }
}

// Arrondi à 0,1° (~10 km) : le globe public ne révèle jamais un point exact.
const arrondir = (v: number) => Math.round(v * 10) / 10

/** Un point par zone de ~10 km, le plus fourni en premier. Le GPS de la photo prime sur le lieu géocodé. */
export function regrouperLieux(especes: EspeceLieu[]): PointGlobe[] {
  const zones = new Map<string, { noms: Set<string>; position: [number, number]; especes: PointGlobe['especes'] }>()
  for (const e of especes) {
    const p = e.data.coordonnees ?? e.data.positionLieu
    if (!p) continue
    const position: [number, number] = [arrondir(p[0]), arrondir(p[1])]
    const cle = position.join(',')
    const zone = zones.get(cle) ?? { noms: new Set<string>(), position, especes: [] }
    if (e.data.lieu) zone.noms.add(e.data.lieu)
    zone.especes.push({ nom: e.data.nomCommun, sci: e.data.nomScientifique, url: `/${e.categorie}/${e.slug}/` })
    zones.set(cle, zone)
  }
  return [...zones.values()]
    .map((z) => ({ nom: [...z.noms].join(' · ') || 'Lieu d’observation', position: z.position, especes: z.especes }))
    .sort((a, b) => b.especes.length - a.especes.length)
}
