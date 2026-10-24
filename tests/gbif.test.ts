import { it, expect, vi, afterEach } from 'vitest'
import { suggerer, details } from '../admin/gbif'

const reponse = (corps: unknown, ok = true) => ({ ok, status: ok ? 200 : 503, json: async () => corps })
function simuler(routes: Record<string, unknown>) {
  const f = vi.fn(async (url: string) => {
    const cle = Object.keys(routes).find((r) => url.includes(r))
    return cle ? reponse(routes[cle]) : reponse({}, false)
  })
  vi.stubGlobal('fetch', f)
  return f
}
afterEach(() => vi.unstubAllGlobals())

it('suggerer renvoie le nom canonique et le rang', async () => {
  simuler({ '/species/suggest': [{ key: 5219243, canonicalName: 'Vulpes vulpes', rank: 'SPECIES' }] })
  expect(await suggerer('vulpes')).toEqual([{ key: 5219243, nomScientifique: 'Vulpes vulpes', rang: 'SPECIES' }])
})

it('suggerer ignore les requêtes trop courtes', async () => {
  const f = simuler({})
  expect(await suggerer('a')).toEqual([])
  expect(f).not.toHaveBeenCalled()
})

it('details trouve le nom français et classe l’espèce', async () => {
  simuler({
    '/species/5219243/vernacularNames': { results: [
      { vernacularName: 'Red Fox', language: 'eng' },
      { vernacularName: 'renard roux', language: 'fra' },
    ] },
    '/species/5219243': { key: 5219243, canonicalName: 'Vulpes vulpes', kingdom: 'Animalia', class: 'Mammalia' },
  })
  expect(await details(5219243)).toEqual({
    nomScientifique: 'Vulpes vulpes', nomCommun: 'Renard roux', categorie: 'faune', groupe: 'Mammifères', gbifKey: 5219243,
    statutUicn: null,
  })
})

it('details récupère le statut UICN quand il existe', async () => {
  simuler({
    '/species/9/iucnRedListCategory': { category: 'LEAST_CONCERN', code: 'LC' },
    '/species/9/vernacularNames': { results: [] },
    '/species/9': { key: 9, canonicalName: 'X y', kingdom: 'Animalia', class: 'Reptilia' },
  })
  expect(await details(9)).toMatchObject({ statutUicn: 'LC' })
})

it('details sans nom français → nomCommun null', async () => {
  simuler({
    '/species/1/vernacularNames': { results: [{ vernacularName: 'Thing', language: 'eng' }] },
    '/species/1': { key: 1, canonicalName: 'X y', kingdom: 'Plantae', class: 'Liliopsida' },
  })
  expect(await details(1)).toMatchObject({ nomCommun: null, categorie: 'flore', groupe: 'Fleurs' })
})

it('details suit un synonyme vers le nom accepté', async () => {
  simuler({
    '/species/2/vernacularNames': { results: [] },
    '/species/3/vernacularNames': { results: [{ vernacularName: 'Accepté', language: 'fra' }] },
    '/species/2': { key: 2, canonicalName: 'Ancien nom', synonym: true, acceptedKey: 3, kingdom: 'Animalia', class: 'Aves' },
    '/species/3': { key: 3, canonicalName: 'Nom accepté', kingdom: 'Animalia', class: 'Aves' },
  })
  expect(await details(2)).toMatchObject({ nomScientifique: 'Nom accepté', nomCommun: 'Accepté', gbifKey: 3 })
})

it('GBIF injoignable → message clair', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('fetch failed') }))
  await expect(suggerer('vulpes')).rejects.toThrow('GBIF indisponible — saisis le nom à la main')
  await expect(details(1)).rejects.toThrow('GBIF indisponible')
})
