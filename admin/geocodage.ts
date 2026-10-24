// Position approximative d'un lieu saisi, via Nominatim (OpenStreetMap).
// shortcut: aucune file d'attente — on reste sous 1 requête/s parce qu'on ne géocode qu'à l'enregistrement d'une fiche.
const API = 'https://nominatim.openstreetmap.org/search'

export async function geocoder(lieu: string): Promise<[number, number] | null> {
  const q = lieu.trim()
  if (!q) return null
  try {
    const r = await fetch(`${API}?q=${encodeURIComponent(q)}&format=jsonv2&limit=1&accept-language=fr`, {
      // Nominatim exige un User-Agent identifiant l'application ; pas de donnée personnelle ici.
      headers: { 'User-Agent': 'carnet-de-terrain-admin/1.0 (portfolio naturaliste, usage personnel)' },
      signal: AbortSignal.timeout(8000),
    })
    if (!r.ok) return null
    const [premier] = (await r.json()) as { lat: string; lon: string }[]
    if (!premier) return null
    return [+(+premier.lat).toFixed(5), +(+premier.lon).toFixed(5)]
  } catch {
    // Le géocodage est un confort : son échec ne doit jamais bloquer l'enregistrement.
    return null
  }
}
