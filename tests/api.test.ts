import { it, expect, beforeEach, describe } from 'vitest'
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

it('route inconnue → 404', async () => {
  expect((await appeler('GET', '/api/nimporte')).status).toBe(404)
})
