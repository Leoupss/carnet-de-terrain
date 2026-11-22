// Zones de présence d'une espèce : cases de 2° là où GBIF a des observations (carte de densité, projection EPSG:4326).
// Plus fin que le pays entier ; inclut aussi cultures et captivité, mais les points isolés sont écartés.
import sharp from 'sharp'

const TAILLE = 2   // côté d'une case, en degrés (~200 km)
const MIN = 2      // pixels minimum par case : un seul point = individu isolé, égaré ou captif
const PX = 512     // une tuile de niveau 0 : 512 px pour 180°

/** Cases [lat, lon] (coin sud-ouest) d'une tuile RGBA ; `x` = 0 pour l'hémisphère ouest, 1 pour l'est. */
export function cellulesDepuisTuile(rgba: Uint8Array, x: 0 | 1): [number, number][] {
  const comptes = new Map<string, number>()
  for (let py = 0; py < PX; py++) for (let px = 0; px < PX; px++) {
    if (!rgba[(py * PX + px) * 4 + 3]) continue
    const lon = -180 + x * 180 + (px + 0.5) * (180 / PX)
    const lat = 90 - (py + 0.5) * (180 / PX)
    const cle = `${Math.floor(lat / TAILLE) * TAILLE},${Math.floor(lon / TAILLE) * TAILLE}`
    comptes.set(cle, (comptes.get(cle) ?? 0) + 1)
  }
  return [...comptes].filter(([, n]) => n >= MIN).map(([c]) => c.split(',').map(Number) as [number, number])
}

export async function zones(gbifKey: number): Promise<[number, number][] | null> {
  try {
    const cases: [number, number][] = []
    for (const x of [0, 1] as const) {
      const r = await fetch(`https://api.gbif.org/v2/map/occurrence/density/0/${x}/0@1x.png?srs=EPSG:4326&taxonKey=${gbifKey}`, {
        signal: AbortSignal.timeout(15000),
      })
      if (!r.ok) return null
      if (r.status === 204) continue // aucune observation dans cet hémisphère
      const { data } = await sharp(Buffer.from(await r.arrayBuffer())).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
      cases.push(...cellulesDepuisTuile(new Uint8Array(data), x))
    }
    return cases.sort((a, b) => a[0] - b[0] || a[1] - b[1])
  } catch {
    return null
  }
}
