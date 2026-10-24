import { it, expect, vi, afterEach, describe } from 'vitest'
import { extraireExtraits, aideSaisie } from '../admin/wikipedia'

describe('extraireExtraits', () => {
  it('taille : garde les mensurations, écarte œufs et altitude', () => {
    const e = extraireExtraits([
      'Le shama dayal mesure environ 19 cm de long.',
      'Les shamas dayal peuvent nicher de 1600 à 2000 m d\'altitude dans les contreforts de l\'Himalaya.',
      'Les œufs, de 21 sur 12 mm sont vert pâle.',
      'Les mâles mesurent de 2 à 3,6 mm et les femelles de 7 à 10 mm.',
    ].join(' '))
    expect(e.taille).toEqual(['Le shama dayal mesure environ 19 cm de long.', 'Les mâles mesurent de 2 à 3,6 mm et les femelles de 7 à 10 mm.'])
  })

  it('poids, régime, habitat, floraison', () => {
    const e = extraireExtraits([
      'En France, les cerfs mâles pèsent entre 120 et 250 kg.',
      'Le shama dayal est insectivore et ingurgite fourmis et chenilles.',
      'Il vit dans les forêts claires et les jardins.',
      'La floraison a lieu de juin à septembre.',
      'C\'est l\'oiseau national du Bangladesh.',
    ].join('\n'))
    expect(e.poids).toEqual(['En France, les cerfs mâles pèsent entre 120 et 250 kg.'])
    expect(e.regime).toEqual(['Le shama dayal est insectivore et ingurgite fourmis et chenilles.'])
    expect(e.habitat).toEqual(['Il vit dans les forêts claires et les jardins.'])
    expect(e.floraison).toEqual(['La floraison a lieu de juin à septembre.'])
  })

  it('ignore les titres de section et limite à 3 phrases par champ', () => {
    const texte = '== Description ==\n' + Array.from({ length: 5 }, (_, i) => `Il mesure ${i + 10} cm de long.`).join(' ')
    const e = extraireExtraits(texte)
    expect(e.taille).toHaveLength(3)
    expect(Object.values(e).flat().some((p) => p.includes('=='))).toBe(false)
  })

  it('texte vide → listes vides', () => {
    expect(extraireExtraits('')).toEqual({ taille: [], poids: [], regime: [], habitat: [], floraison: [] })
  })
})

describe('aideSaisie', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('cherche le nom scientifique puis le nom commun, et donne le lien iNaturalist', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => ({
      ok: true,
      json: async () => url.includes('inaturalist')
        ? { results: [{ id: 12727 }] }
        : url.includes('titles=Copsychus')
          ? { query: { pages: { '-1': { title: 'Copsychus saularis', missing: '' } } } }
          : { query: { pages: { '42': { title: 'Shama dayal', extract: 'Il mesure 19 cm de long.' } } } },
    })))
    const a = await aideSaisie('Copsychus saularis', 'Shama dayal')
    expect(a.titre).toBe('Shama dayal')
    expect(a.url).toBe('https://fr.wikipedia.org/wiki/Shama_dayal')
    expect(a.inaturalist).toBe('https://www.inaturalist.org/taxa/12727')
    expect(a.extraits.taille).toEqual(['Il mesure 19 cm de long.'])
  })

  it('services injoignables → aide vide, sans erreur', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('fetch failed') }))
    const a = await aideSaisie('Vulpes vulpes')
    expect(a).toMatchObject({ titre: null, url: null, inaturalist: null })
    expect(a.extraits.taille).toEqual([])
  })
})
