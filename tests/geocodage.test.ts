import { it, expect, vi, afterEach } from 'vitest'
import { geocoder } from '../admin/geocodage'

afterEach(() => vi.unstubAllGlobals())

it('renvoie [lat, lon] arrondis du premier résultat', async () => {
  const f = vi.fn(async () => ({ ok: true, json: async () => [{ lat: '14.6710532', lon: '-61.0919656' }] }))
  vi.stubGlobal('fetch', f)
  expect(await geocoder('Jardin de Balata, Martinique')).toEqual([14.67105, -61.09197])
  const [url, opts] = f.mock.calls[0] as unknown as [string, RequestInit]
  expect(url).toContain('q=Jardin%20de%20Balata%2C%20Martinique')
  expect(JSON.stringify(opts.headers)).not.toMatch(/@/)
})

it('aucun résultat → null', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => [] })))
  expect(await geocoder('Nulle part 12345')).toBeNull()
})

it('service injoignable → null, sans lever d’erreur', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('fetch failed') }))
  expect(await geocoder('Paris')).toBeNull()
})

it('lieu vide → null sans appel réseau', async () => {
  const f = vi.fn()
  vi.stubGlobal('fetch', f)
  expect(await geocoder('  ')).toBeNull()
  expect(f).not.toHaveBeenCalled()
})
