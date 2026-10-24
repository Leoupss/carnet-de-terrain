import { readdir, readFile, writeFile, rename, rm, mkdir, access } from 'node:fs/promises'
import { join, resolve, sep } from 'node:path'
import YAML from 'yaml'
import sharp from 'sharp'
import exifr from 'exifr'
import { slugify, assainirNomFichier } from '../src/lib/slug'
import { CATEGORIES, GROUPES, estCategorie, type Categorie } from '../src/lib/categories'

export type Fiche = {
  nomScientifique: string
  nomCommun: string
  groupe: string
  ajoute: string
  lieu?: string
  coordonnees?: [number, number]
  gbifKey?: number
  dateObservation?: string
  taille?: string
  poids?: string
  habitat?: string
  floraison?: string
  regime?: string
  statutUicn?: string
  /** Texte libre, écrit sous le frontmatter de fiche.md. */
  description?: string
}
export type EspeceAdmin = { categorie: Categorie; slug: string; fiche: Fiche; photos: string[] }

/** Champs modifiables depuis l'admin (en plus de coordonnees, géré par le GPS). */
export const CHAMPS_MODIFIABLES = [
  'nomCommun', 'groupe', 'lieu', 'dateObservation', 'taille', 'poids', 'habitat', 'floraison', 'regime', 'statutUicn', 'description',
] as const
export type ChampModifiable = (typeof CHAMPS_MODIFIABLES)[number]
export const STATUTS_UICN = ['LC', 'NT', 'VU', 'EN', 'CR', 'EW', 'EX', 'DD', 'NE']

const EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp']
const FORMATS = ['jpeg', 'png', 'webp']
const NOM_SUR = /^[a-z0-9]+(-[a-z0-9]+)*(\.[a-z]+)?$/
const COTE_MAX = 2500
const ERREUR_FORMAT = 'Format non pris en charge (JPG, PNG ou WebP uniquement) — exporte la photo en JPG'

/** Chemin absolu sous `racine`, ou erreur si un segment est suspect ou si l'on sort du dossier. */
function chemin(racine: string, categorie: string, slug?: string, nom?: string): string {
  if (!estCategorie(categorie)) throw new Error('Chemin interdit')
  for (const s of [slug, nom]) if (s !== undefined && !NOM_SUR.test(s)) throw new Error('Chemin interdit')
  const base = resolve(racine)
  const p = resolve(base, ...[categorie, slug, nom].filter((s): s is string => s !== undefined))
  if (!p.startsWith(base + sep)) throw new Error('Chemin interdit')
  return p
}

const existe = (p: string) => access(p).then(() => true, () => false)
const estPhoto = (f: string) => EXTENSIONS.includes(f.split('.').pop()!.toLowerCase())

async function lireFiche(dossier: string): Promise<Fiche> {
  const texte = await readFile(join(dossier, 'fiche.md'), 'utf8')
  const m = texte.match(/^---\r?\n([\s\S]*?)\r?\n?---\r?\n?([\s\S]*)$/)
  const fiche = YAML.parse(m?.[1] ?? '') as Fiche
  const description = m?.[2].trim()
  return description ? { ...fiche, description } : fiche
}

async function ecrireFiche(dossier: string, fiche: Fiche): Promise<void> {
  const { description, ...donnees } = fiche
  const propre = Object.fromEntries(Object.entries(donnees).filter(([, v]) => v !== undefined && v !== ''))
  const corps = description?.trim() ? `\n${description.trim()}\n` : ''
  // Écriture puis renommage : une coupure ne laisse jamais une fiche à moitié écrite.
  const tmp = join(dossier, 'fiche.md.tmp')
  await writeFile(tmp, `---\n${YAML.stringify(propre)}---\n${corps}`)
  await rename(tmp, join(dossier, 'fiche.md'))
}

function verifierChamps(categorie: Categorie, champs: Partial<Fiche>): void {
  if (champs.groupe !== undefined && !GROUPES[categorie].includes(champs.groupe)) throw new Error('Groupe invalide')
  if (champs.nomCommun !== undefined && !champs.nomCommun.trim()) throw new Error('Nom commun requis')
  if (champs.statutUicn && !STATUTS_UICN.includes(champs.statutUicn)) throw new Error('Statut UICN invalide')
  if (champs.dateObservation && !/^\d{4}-\d{2}-\d{2}$/.test(champs.dateObservation)) throw new Error('Date invalide (AAAA-MM-JJ)')
}

/** Date de prise de vue EXIF au format AAAA-MM-JJ, dans le fuseau de l'appareil (exifr la lit en heure locale). */
async function dateDePriseDeVue(contenu: Buffer): Promise<string | undefined> {
  const d = (await exifr.parse(contenu, ['DateTimeOriginal']).catch(() => undefined))?.DateTimeOriginal
  if (!(d instanceof Date) || isNaN(d.getTime())) return undefined
  const deux = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`
}

async function lireEspece(racine: string, categorie: Categorie, slug: string): Promise<EspeceAdmin> {
  const dossier = chemin(racine, categorie, slug)
  const photos = (await readdir(dossier)).filter(estPhoto).sort()
  return { categorie, slug, fiche: await lireFiche(dossier), photos }
}

async function dossierEspece(racine: string, categorie: Categorie, slug: string): Promise<string> {
  const dossier = chemin(racine, categorie, slug)
  if (!(await existe(join(dossier, 'fiche.md')))) throw new Error('Espèce introuvable')
  return dossier
}

export async function listerEspeces(racine: string): Promise<EspeceAdmin[]> {
  const toutes: EspeceAdmin[] = []
  for (const categorie of CATEGORIES) {
    const dossier = join(racine, categorie)
    if (!(await existe(dossier))) continue
    for (const slug of await readdir(dossier)) {
      if (NOM_SUR.test(slug) && (await existe(join(dossier, slug, 'fiche.md')))) toutes.push(await lireEspece(racine, categorie, slug))
    }
  }
  return toutes.sort((a, b) => a.fiche.nomCommun.localeCompare(b.fiche.nomCommun, 'fr'))
}

/** L'espèce portant ce nom scientifique, quelle que soit sa catégorie. */
export async function trouverEspece(racine: string, nomScientifique: string): Promise<EspeceAdmin | null> {
  const slug = slugify(nomScientifique)
  for (const categorie of CATEGORIES) {
    if (await existe(join(chemin(racine, categorie, slug), 'fiche.md'))) return lireEspece(racine, categorie, slug)
  }
  return null
}

export async function creerEspece(
  racine: string, categorie: Categorie, fiche: Omit<Fiche, 'ajoute'>,
): Promise<{ espece: EspeceAdmin; existait: boolean }> {
  chemin(racine, categorie)
  const existante = await trouverEspece(racine, fiche.nomScientifique)
  if (existante) return { espece: existante, existait: true }
  if (!GROUPES[categorie].includes(fiche.groupe)) throw new Error('Groupe invalide')
  if (!fiche.nomCommun?.trim()) throw new Error('Nom commun requis')
  verifierChamps(categorie, fiche)

  const slug = slugify(fiche.nomScientifique)
  const dossier = chemin(racine, categorie, slug)
  await mkdir(dossier, { recursive: true })
  const ajoute = new Date().toISOString().slice(0, 10)
  await ecrireFiche(dossier, { ...fiche, nomScientifique: fiche.nomScientifique.trim().replace(/\s+/g, ' '), nomCommun: fiche.nomCommun.trim(), ajoute })
  return { espece: await lireEspece(racine, categorie, slug), existait: false }
}

export async function modifierFiche(
  racine: string, categorie: Categorie, slug: string,
  champs: Partial<Pick<Fiche, ChampModifiable | 'coordonnees'>>,
): Promise<Fiche> {
  const dossier = await dossierEspece(racine, categorie, slug)
  verifierChamps(categorie, champs)
  const fiche = { ...(await lireFiche(dossier)), ...champs }
  await ecrireFiche(dossier, fiche)
  return fiche
}

export async function ajouterPhoto(
  racine: string, categorie: Categorie, slug: string, nomOriginal: string, contenu: Buffer,
): Promise<{ nom: string; coordonnees?: [number, number] }> {
  const dossier = await dossierEspece(racine, categorie, slug)
  const propre = assainirNomFichier(nomOriginal)
  const point = propre.lastIndexOf('.')
  const extDonnee = point > 0 ? propre.slice(point + 1) : ''
  if (!EXTENSIONS.includes(extDonnee)) throw new Error(ERREUR_FORMAT)

  const meta = await sharp(contenu).metadata().catch(() => null)
  if (!meta?.format || !FORMATS.includes(meta.format)) throw new Error(ERREUR_FORMAT)
  // L'extension suit le vrai contenu (un PNG renommé en .jpg reste un .png).
  const ext = meta.format === 'jpeg' ? (extDonnee === 'jpeg' ? 'jpeg' : 'jpg') : meta.format

  const gps = await exifr.gps(contenu).catch(() => undefined)
  const coordonnees = gps ? ([+gps.latitude.toFixed(5), +gps.longitude.toFixed(5)] as [number, number]) : undefined

  const base = propre.slice(0, point)
  let nom = propre
  for (let i = 2; await existe(join(dossier, nom)); i++) nom = `${base}-${i}.${ext}`

  // rotate() applique l'orientation EXIF ; sharp retire ensuite les métadonnées (donc le GPS).
  const image = await sharp(contenu)
    .rotate()
    .resize(COTE_MAX, COTE_MAX, { fit: 'inside', withoutEnlargement: true })
    .toFormat(meta.format as 'jpeg' | 'png' | 'webp', { quality: 90 })
    .toBuffer()
  await writeFile(join(chemin(racine, categorie, slug, nom)), image, { flag: 'wx' })

  // La première photo qui porte un GPS ou une date les donne à la fiche ; on n'écrase jamais.
  const dateObservation = await dateDePriseDeVue(contenu)
  if (coordonnees || dateObservation) {
    const fiche = await lireFiche(dossier)
    const ajouts: Partial<Fiche> = {}
    if (coordonnees && !fiche.coordonnees) ajouts.coordonnees = coordonnees
    if (dateObservation && !fiche.dateObservation) ajouts.dateObservation = dateObservation
    if (Object.keys(ajouts).length) await ecrireFiche(dossier, { ...fiche, ...ajouts })
  }
  return { nom, coordonnees }
}

export async function retirerPhoto(racine: string, categorie: Categorie, slug: string, nom: string): Promise<void> {
  if (!estPhoto(nom)) throw new Error('Chemin interdit')
  const p = chemin(racine, categorie, slug, nom)
  await dossierEspece(racine, categorie, slug)
  await rm(p)
}

export async function supprimerEspece(racine: string, categorie: Categorie, slug: string): Promise<void> {
  const dossier = await dossierEspece(racine, categorie, slug)
  await rm(dossier, { recursive: true })
}
