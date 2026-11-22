// Répartition d'une espèce : pays où GBIF recense des observations, en codes ISO numériques (ceux de la carte du monde).
// Limite connue : GBIF inclut cultures et captivité ; c'est « où on la trouve », pas l'aire naturelle.
import pays from 'i18n-iso-countries'

const SEUIL = 5 // en dessous : individus isolés, égarés ou en captivité

export function paysDepuisFacettes(comptes: { name: string; count: number }[], seuil = SEUIL): string[] {
  const codes = comptes.filter((c) => c.count >= seuil).map((c) => pays.alpha2ToNumeric(c.name)).filter((c): c is string => Boolean(c))
  return [...new Set(codes)].sort()
}

export async function repartition(gbifKey: number): Promise<string[] | null> {
  try {
    const r = await fetch(`https://api.gbif.org/v1/occurrence/search?taxonKey=${gbifKey}&facet=country&facetLimit=300&limit=0`, {
      signal: AbortSignal.timeout(10000),
    })
    if (!r.ok) return null
    const d = (await r.json()) as { facets?: { field: string; counts: { name: string; count: number }[] }[] }
    return paysDepuisFacettes(d.facets?.find((f) => f.field === 'COUNTRY')?.counts ?? [])
  } catch {
    return null
  }
}
