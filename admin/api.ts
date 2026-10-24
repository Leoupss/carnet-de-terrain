import type { IncomingMessage, ServerResponse } from 'node:http'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { slugify } from '../src/lib/slug'
import { estCategorie, GROUPES, type Categorie } from '../src/lib/categories'
import * as fichiers from './fichiers'
import { suggerer, details } from './gbif'
import { geocoder } from './geocodage'
import { aideSaisie } from './wikipedia'
import { resume, publier } from './publier'

const UI = fileURLToPath(new URL('./ui/', import.meta.url))
const TAILLE_MAX = 60 * 1024 * 1024
const LOCAL = /^(localhost|127\.0\.0\.1)(:\d+)?$/
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
}

/** Un site tiers ouvert dans le navigateur ne doit pas pouvoir piloter l'admin locale. */
export function origineAutorisee(origin: string | undefined, methode: string): boolean {
  if (methode === 'GET' || methode === 'HEAD') return true
  if (!origin) return false
  try {
    const u = new URL(origin)
    return u.protocol === 'http:' && LOCAL.test(u.host)
  } catch {
    return false
  }
}

class ErreurHttp extends Error {
  constructor(public status: number, message: string) { super(message) }
}

function lireCorps(req: IncomingMessage): Promise<Buffer> {
  return new Promise((ok, ko) => {
    const morceaux: Buffer[] = []
    let taille = 0
    req.on('data', (m: Buffer) => {
      taille += m.length
      if (taille > TAILLE_MAX) { ko(new ErreurHttp(413, 'Fichier trop lourd (60 Mo maximum)')); req.destroy() }
      else morceaux.push(m)
    })
    req.on('end', () => ok(Buffer.concat(morceaux)))
    req.on('error', ko)
  })
}

const lireJson = async (req: IncomingMessage) => {
  try { return JSON.parse(String(await lireCorps(req)) || '{}') } catch { throw new ErreurHttp(400, 'JSON invalide') }
}

/** Ne garde que les champs modifiables envoyés sous forme de texte ; une chaîne vide efface le champ. */
function champsTexte(b: Record<string, unknown>): Partial<Record<fichiers.ChampModifiable, string>> {
  const champs: Partial<Record<fichiers.ChampModifiable, string>> = {}
  for (const c of fichiers.CHAMPS_MODIFIABLES) if (typeof b[c] === 'string') champs[c] = (b[c] as string).trim()
  return champs
}

/** "14.67, -61.09" → [14.67, -61.09] ; "" → null (effacer). */
function lirePosition(texte: string): [number, number] | null {
  if (!texte.trim()) return null
  const m = texte.match(/^\s*(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)\s*$/)
  const [lat, lon] = m ? [Number(m[1]), Number(m[2])] : [NaN, NaN]
  if (!(Math.abs(lat) <= 90 && Math.abs(lon) <= 180)) throw new ErreurHttp(400, 'Position invalide : « latitude, longitude », ex. 14.67, -61.09')
  return [lat, lon]
}
const texteDePosition = (p: [number, number] | null | undefined) => (p ? p.join(', ') : '')

function categorie(v: string): Categorie {
  if (!estCategorie(v)) throw new ErreurHttp(400, 'Catégorie inconnue')
  return v
}

function statutPour(e: Error): number {
  if (e instanceof ErreurHttp) return e.status
  if (e.message.startsWith('GBIF')) return 502
  if (e.message.startsWith('Échec de la publication')) return 500
  if (e.message === 'Espèce introuvable') return 404
  return 400
}

export function creerMiddleware(opts: { racine: string; projet: string }) {
  const { racine, projet } = opts

  async function router(req: IncomingMessage, res: ServerResponse): Promise<unknown | typeof PAS_TROUVE> {
    const url = new URL(req.url ?? '/', 'http://localhost')
    const m = req.method ?? 'GET'
    const p = url.pathname.replace(/\/+$/, '') || '/'
    const seg = p.split('/').filter(Boolean).map(decodeURIComponent)

    // Fichiers de l'interface
    if (m === 'GET' && (p === '/' || p === '/admin.js' || p === '/admin.css')) {
      const nom = p === '/' ? 'index.html' : p.slice(1)
      res.setHeader('Content-Type', TYPES[nom.slice(nom.lastIndexOf('.'))])
      res.setHeader('Cache-Control', 'no-store')
      res.end(await readFile(join(UI, nom)))
      return ENVOYE
    }
    if (seg[0] !== 'api') return PAS_TROUVE
    const r = seg.slice(1)

    if (m === 'GET' && r[0] === 'config' && r.length === 1) return { groupes: GROUPES }
    if (m === 'GET' && r[0] === 'aide' && r.length === 1) {
      const sci = url.searchParams.get('sci')?.trim()
      if (!sci) throw new ErreurHttp(400, 'Nom scientifique requis')
      return aideSaisie(sci, url.searchParams.get('commun') ?? undefined)
    }
    if (m === 'GET' && r[0] === 'gbif' && r[1] === 'suggest') return suggerer(url.searchParams.get('q') ?? '')
    if (m === 'GET' && r[0] === 'gbif' && r[1] === 'espece' && r[2]) return details(Number(r[2]))

    if (r[0] === 'publier' && r.length === 1) {
      if (m === 'GET') return resume(projet)
      if (m === 'POST') return publier(projet)
    }

    if (r[0] !== 'especes') return PAS_TROUVE

    if (r.length === 1 && m === 'GET') return fichiers.listerEspeces(racine)
    if (r.length === 2 && r[1] === 'existe' && m === 'GET') {
      const e = await fichiers.trouverEspece(racine, url.searchParams.get('nom') ?? '')
      return e ? { existe: true, categorie: e.categorie, slug: e.slug } : { existe: false }
    }
    if (r.length === 1 && m === 'POST') {
      const b = await lireJson(req)
      const cat = categorie(b.categorie)
      if (typeof b.nomScientifique !== 'string') throw new ErreurHttp(400, 'Nom scientifique requis')
      if (typeof b.nomCommun !== 'string' || !b.nomCommun.trim()) throw new ErreurHttp(400, 'Nom commun requis')
      if (!GROUPES[cat].includes(b.groupe)) throw new ErreurHttp(400, 'Groupe invalide')
      const r = await fichiers.creerEspece(racine, cat, {
        ...champsTexte(b),
        nomScientifique: b.nomScientifique, nomCommun: b.nomCommun, groupe: b.groupe,
        gbifKey: Number.isInteger(b.gbifKey) ? b.gbifKey : undefined,
      })
      if (!r.existait && r.espece.fiche.lieu) {
        const positionLieu = await geocoder(r.espece.fiche.lieu)
        if (positionLieu) r.espece.fiche = await fichiers.modifierFiche(racine, cat, r.espece.slug, { positionLieu })
      }
      return r
    }

    if (r.length >= 3) {
      const cat = categorie(r[1])
      const slug = r[2]
      if (r.length === 3 && m === 'PATCH') {
        const b = await lireJson(req)
        const avant = await fichiers.lireFicheEspece(racine, cat, slug)
        const champs: Parameters<typeof fichiers.modifierFiche>[3] = champsTexte(b)
        const saisie = typeof b.positionLieu === 'string' ? lirePosition(b.positionLieu) : undefined
        const lieu = champs.lieu ?? avant.lieu

        if (saisie !== undefined && texteDePosition(saisie) !== texteDePosition(avant.positionLieu)) {
          champs.positionLieu = saisie ?? undefined
        } else if (!lieu) {
          champs.positionLieu = undefined
        } else if (lieu !== avant.lieu || !avant.positionLieu) {
          champs.positionLieu = (await geocoder(lieu)) ?? undefined
        }
        return fichiers.modifierFiche(racine, cat, slug, champs)
      }
      if (r.length === 3 && m === 'DELETE') { await fichiers.supprimerEspece(racine, cat, slug); return { ok: true } }
      if (r[3] === 'photos') {
        if (r.length === 4 && m === 'POST') {
          const nom = url.searchParams.get('nom')
          if (!nom) throw new ErreurHttp(400, 'Nom de fichier manquant')
          return fichiers.ajouterPhoto(racine, cat, slug, nom, await lireCorps(req))
        }
        if (r.length === 5 && m === 'DELETE') { await fichiers.retirerPhoto(racine, cat, slug, r[4]); return { ok: true } }
        if (r.length === 5 && m === 'GET') {
          const e = (await fichiers.listerEspeces(racine)).find((x) => x.categorie === cat && x.slug === slug)
          if (!e?.photos.includes(r[4])) throw new ErreurHttp(404, 'Photo introuvable')
          res.setHeader('Content-Type', TYPES[r[4].split('.').pop()!] ?? 'application/octet-stream')
          res.end(await readFile(join(racine, cat, slug, r[4])))
          return ENVOYE
        }
      }
    }
    return PAS_TROUVE
  }

  return (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const json = (status: number, corps: unknown) => {
      res.statusCode = status
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end(JSON.stringify(corps))
    }
    // Host local obligatoire (contre le rebinding DNS), Origin local pour toute écriture.
    if (!LOCAL.test(req.headers.host ?? '') || !origineAutorisee(req.headers.origin, req.method ?? 'GET')) {
      return json(403, { erreur: 'Requête refusée : l’admin n’accepte que les appels locaux' })
    }
    router(req, res).then(
      (r) => {
        if (r === ENVOYE) return
        if (r === PAS_TROUVE) return json(404, { erreur: 'Route inconnue' })
        json(200, r)
      },
      (e: Error) => json(statutPour(e), { erreur: e.message }),
    )
  }
}

const ENVOYE = Symbol('envoyé')
const PAS_TROUVE = Symbol('pas trouvé')
