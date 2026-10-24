import { it, expect, beforeEach, afterEach, describe, vi } from 'vitest'
import { Readable } from 'node:stream'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { origineAutorisee, creerMiddleware } from '../admin/api'

let racine: string
beforeEach(async () => { racine = await mkdtemp(join(tmpdir(), 'api-')) })

type Rep = { status: number; corps: any }
function appeler(methode: string, url: string, opts: { corps?: unknown; origin?: string; host?: string } = {}): Promise<Rep> {
  const mw = creerMiddleware({ racine, projet: racine })
  const brut = opts.corps === undefined ? [] : [Buffer.from(JSON.stringify(opts.corps))]
  const req = Object.assign(Readable.from(brut), {
    method: methode, url,
    headers: { host: opts.host ?? 'localhost:4321', ...(opts.origin ? { origin: opts.origin } : {}), 'content-type': 'application/json' },
  })
  return new Promise((resolve) => {
    const res: any = {
      statusCode: 200, setHeader() {},
      end(b?: string | Buffer) { resolve({ status: this.statusCode, corps: b ? JSON.parse(String(b)) : null }) },
    }
    mw(req as any, res, () => resolve({ status: 404, corps: 'next' }))
  })
}

describe('origineAutorisee', () => {
  it.each([
    ['https://evil.com', 'POST', false],
    ['http://localhost:4321', 'POST', true],
    ['http://127.0.0.1:4321', 'DELETE', true],
    ['http://localhost.evil.com', 'POST', false],
    [undefined, 'POST', false],
    [undefined, 'GET', true],
  ] as const)('%s %s → %s', (o, m, attendu) => expect(origineAutorisee(o, m)).toBe(attendu))
})

const valide = { categorie: 'faune', nomScientifique: 'Vulpes vulpes', nomCommun: 'Renard roux', groupe: 'Mammifères' }

it('refuse un POST sans Origin', async () => {
  expect((await appeler('POST', '/api/especes', { corps: valide })).status).toBe(403)
})

it('refuse un Host étranger (rebinding DNS)', async () => {
  expect((await appeler('GET', '/api/especes', { host: 'evil.com' })).status).toBe(403)
})

it('crée une espèce puis la liste', async () => {
  const r = await appeler('POST', '/api/especes', { corps: valide, origin: 'http://localhost:4321' })
  expect(r.status).toBe(200)
  expect(r.corps).toMatchObject({ existait: false, espece: { slug: 'vulpes-vulpes' } })
  const l = await appeler('GET', '/api/especes')
  expect(l.corps).toHaveLength(1)
  const e = await appeler('GET', '/api/especes/existe?nom=vulpes%20%20vulpes')
  expect(e.corps).toEqual({ existe: true, categorie: 'faune', slug: 'vulpes-vulpes' })
})

it('groupe invalide → 400', async () => {
  const r = await appeler('POST', '/api/especes', { corps: { ...valide, groupe: 'Fleurs' }, origin: 'http://localhost:4321' })
  expect(r.status).toBe(400)
  expect(r.corps.erreur).toBe('Groupe invalide')
})

describe('position du lieu', () => {
  const origin = 'http://localhost:4321'
  const lire = async () => (await appeler('GET', '/api/especes')).corps[0].fiche
  let requetes: string[]
  beforeEach(() => {
    requetes = []
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      requetes.push(url)
      const q = new URL(url).searchParams.get('q')
      const res = q === 'Martinique' ? [{ lat: '14.6', lon: '-61' }] : q === 'Paris' ? [{ lat: '48.85', lon: '2.35' }] : []
      return { ok: true, json: async () => res }
    }))
  })
  afterEach(() => vi.unstubAllGlobals())

  it('géocode le lieu à la création', async () => {
    await appeler('POST', '/api/especes', { corps: { ...valide, lieu: 'Martinique' }, origin })
    expect((await lire()).positionLieu).toEqual([14.6, -61])
  })

  it('re-géocode quand le lieu change, efface quand il est vidé', async () => {
    await appeler('POST', '/api/especes', { corps: { ...valide, lieu: 'Martinique' }, origin })
    await appeler('PATCH', '/api/especes/faune/vulpes-vulpes', { corps: { lieu: 'Paris' }, origin })
    expect((await lire()).positionLieu).toEqual([48.85, 2.35])
    await appeler('PATCH', '/api/especes/faune/vulpes-vulpes', { corps: { lieu: '' }, origin })
    expect((await lire()).positionLieu).toBeUndefined()
  })

  it('ne re-géocode pas un lieu inchangé déjà positionné', async () => {
    await appeler('POST', '/api/especes', { corps: { ...valide, lieu: 'Martinique' }, origin })
    requetes = []
    await appeler('PATCH', '/api/especes/faune/vulpes-vulpes', { corps: { lieu: 'Martinique', taille: '1 m' }, origin })
    expect(requetes).toEqual([])
  })

  it('une position saisie à la main l’emporte', async () => {
    await appeler('POST', '/api/especes', { corps: { ...valide, lieu: 'Martinique' }, origin })
    await appeler('PATCH', '/api/especes/faune/vulpes-vulpes', { corps: { lieu: 'Paris', positionLieu: '14.7, -61.1' }, origin })
    expect((await lire()).positionLieu).toEqual([14.7, -61.1])
  })

  it('position invalide → 400', async () => {
    await appeler('POST', '/api/especes', { corps: valide, origin })
    const r = await appeler('PATCH', '/api/especes/faune/vulpes-vulpes', { corps: { positionLieu: '200, 3' }, origin })
    expect(r.status).toBe(400)
  })
})

it('route inconnue → 404', async () => {
  expect((await appeler('GET', '/api/nimporte')).status).toBe(404)
})
