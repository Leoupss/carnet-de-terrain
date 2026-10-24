// Aide à la saisie : phrases de l'article Wikipédia FR classées par champ, plus les liens de vérification.
// Rien n'est rempli automatiquement : l'admin propose, l'utilisateur choisit.
const UA = { 'User-Agent': 'carnet-de-terrain-admin/1.0 (portfolio naturaliste, usage personnel)' }
const MAX_PAR_CHAMP = 3

export type Extraits = { taille: string[]; poids: string[]; regime: string[]; habitat: string[]; floraison: string[] }
export type Aide = { titre: string | null; url: string | null; inaturalist: string | null; extraits: Extraits }

const NOMBRE = String.raw`\d+(?:[,.]\d+)?`
const REGLES: Record<keyof Extraits, { garde: RegExp; ecarte?: RegExp }> = {
  taille: {
    garde: new RegExp(`(?=.*${NOMBRE}\\s*(?:mm|cm|m|millimètres?|centimètres?|mètres?)\\b)(?=.*(?:mesur|taille|longueur|envergure|hauteur|haut|long|atteint|garrot|diamètre))`, 'i'),
    // Les mesures d'œufs, de nids ou d'altitude ne décrivent pas l'animal.
    ecarte: /œufs?|oeufs?|altitude|nids?\b|ponte|profondeur/i,
  },
  poids: { garde: new RegExp(`${NOMBRE}\\s*(?:kg|g|grammes?|kilogrammes?|kilos?)\\b|\\bpès|\\bpoids\\b`, 'i'), ecarte: /œufs?|oeufs?/i },
  regime: { garde: /se nourri|nourriture|régime|alimentation|insectivore|frugivore|herbivore|carnivore|granivore|nectarivore|omnivore|piscivore|\bproies?\b|consomme|\bmange/i },
  habitat: { garde: /habitat|vit dans|vit en|vivent|fréquente|\bmilieux?\b|forêts?|prairies?|zones humides|mangroves?|jardins|endémique|originaire|répartition/i },
  floraison: { garde: /floraison|fleurit|fleurissent|en fleurs?\b/i },
}

function phrases(texte: string): string[] {
  return texte
    .split(/\n+|(?<=[.!?…])\s+(?=[A-ZÀ-ÖØ-Þ«"(])/)
    .map((p) => p.trim())
    // Titres de section (« == Description == ») et lignes sans ponctuation finale : pas des phrases.
    .filter((p) => p && !p.startsWith('=') && /[.!?…]$/.test(p) && p.length <= 300)
}

export function extraireExtraits(texte: string): Extraits {
  const liste = phrases(texte)
  const extraits = {} as Extraits
  for (const [champ, { garde, ecarte }] of Object.entries(REGLES) as [keyof Extraits, (typeof REGLES)[keyof Extraits]][]) {
    extraits[champ] = [...new Set(liste.filter((p) => garde.test(p) && !ecarte?.test(p)))].slice(0, MAX_PAR_CHAMP)
  }
  return extraits
}

async function lireJson<T>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(8000) })
    return r.ok ? ((await r.json()) as T) : null
  } catch {
    return null
  }
}

async function article(titre: string): Promise<{ titre: string; texte: string } | null> {
  const r = await lireJson<{ query?: { pages?: Record<string, { title: string; extract?: string; missing?: string }> } }>(
    `https://fr.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&redirects=1&format=json&titles=${encodeURIComponent(titre)}`,
  )
  const page = Object.values(r?.query?.pages ?? {}).find((p) => p.extract && p.missing === undefined)
  return page ? { titre: page.title, texte: page.extract! } : null
}

export async function aideSaisie(nomScientifique: string, nomCommun?: string): Promise<Aide> {
  // Nom scientifique d'abord : il est sans ambiguïté (« Goupil » est un article sur le mot, « Vulpes vulpes » redirige vers Renard roux).
  const candidats = [nomScientifique, nomCommun].map((t) => t?.trim()).filter((t): t is string => Boolean(t))
  const [trouve, inat] = await Promise.all([
    (async () => {
      for (const t of candidats) {
        const a = await article(t)
        if (a) return a
      }
      return null
    })(),
    lireJson<{ results?: { id: number }[] }>(
      `https://api.inaturalist.org/v1/taxa?q=${encodeURIComponent(nomScientifique)}&rank=species&per_page=1`,
    ),
  ])
  const id = inat?.results?.[0]?.id
  return {
    titre: trouve?.titre ?? null,
    url: trouve ? `https://fr.wikipedia.org/wiki/${encodeURIComponent(trouve.titre.replace(/ /g, '_'))}` : null,
    inaturalist: id ? `https://www.inaturalist.org/taxa/${id}` : null,
    extraits: extraireExtraits(trouve?.texte ?? ''),
  }
}
