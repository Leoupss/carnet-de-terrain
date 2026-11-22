import { it, expect, vi, afterEach } from 'vitest'
import { paysDepuisFacettes, repartition } from '../admin/repartition'

afterEach(() => vi.unstubAllGlobals())

it('convertit les pays GBIF (ISO alpha-2) en codes numériques, sous un seuil d’observations', () => {
  expect(paysDepuisFacettes([
    { name: 'TH', count: 105239 },
    { name: 'FR', count: 12 },
    { name: 'DE', count: 3 },   // trop peu : individus isolés ou captifs
    { name: 'ZZ', count: 50 },  // code inconnu : ignoré
  ])).toEqual(['250', '764'])
})

it('interroge GBIF par identifiant d’espèce', async () => {
  const f = vi.fn(async () => ({ ok: true, json: async () => ({ facets: [{ field: 'COUNTRY', counts: [{ name: 'TH', count: 40 }] }] }) }))
  vi.stubGlobal('fetch', f)
  expect(await repartition(2492680)).toEqual(['764'])
  expect(String((f.mock.calls[0] as unknown as [string])[0])).toContain('taxonKey=2492680')
})

it('GBIF injoignable → null (on garde la répartition déjà connue)', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('fetch failed') }))
  expect(await repartition(1)).toBeNull()
})
