import { classerDepuisGbif, type Categorie } from '../src/lib/categories'

const API = 'https://api.gbif.org/v1'
const INDISPONIBLE = 'GBIF indisponible — saisis le nom à la main'

async function lire<T>(chemin: string): Promise<T> {
  try {
    const r = await fetch(`${API}${chemin}`, { signal: AbortSignal.timeout(8000) })
    if (!r.ok) throw new Error(String(r.status))
    return (await r.json()) as T
  } catch {
    throw new Error(INDISPONIBLE)
  }
}

type EspeceGbif = { key: number; canonicalName: string; kingdom?: string; class?: string; synonym?: boolean; acceptedKey?: number }

export async function suggerer(q: string): Promise<{ key: number; nomScientifique: string; rang: string }[]> {
  if (q.trim().length < 2) return []
  const r = await lire<{ key: number; canonicalName: string; rank: string }[]>(
    `/species/suggest?q=${encodeURIComponent(q.trim())}&limit=10`,
  )
  return r.filter((s) => s.canonicalName).map((s) => ({ key: s.key, nomScientifique: s.canonicalName, rang: s.rank }))
}

export async function details(key: number): Promise<{
  nomScientifique: string; nomCommun: string | null; categorie: Categorie | null; groupe: string | null; gbifKey: number
}> {
  let espece = await lire<EspeceGbif>(`/species/${key}`)
  if (espece.synonym && espece.acceptedKey) espece = await lire<EspeceGbif>(`/species/${espece.acceptedKey}`)

  const noms = await lire<{ results: { vernacularName: string; language: string }[] }>(
    `/species/${espece.key}/vernacularNames?limit=100`,
  )
  const fr = noms.results.find((n) => n.language === 'fra')?.vernacularName.trim()
  const classe = classerDepuisGbif(espece)
  return {
    nomScientifique: espece.canonicalName,
    nomCommun: fr ? fr[0].toUpperCase() + fr.slice(1) : null,
    categorie: classe?.categorie ?? null,
    groupe: classe?.groupe ?? null,
    gbifKey: espece.key,
  }
}
