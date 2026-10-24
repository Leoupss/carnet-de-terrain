import { describe, it, expect, beforeEach } from 'vitest'
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'
import exifr from 'exifr'
import {
  listerEspeces, creerEspece, modifierFiche, ajouterPhoto, retirerPhoto, supprimerEspece,
} from '../admin/fichiers'

const fiche = { nomScientifique: 'Vulpes vulpes', nomCommun: 'Renard roux', groupe: 'Mammifères' }
const jpeg = (w = 100, h = 80) => sharp({ create: { width: w, height: h, channels: 3, background: '#a0522d' } }).jpeg().toBuffer()

let racine: string
beforeEach(async () => { racine = await mkdtemp(join(tmpdir(), 'especes-')) })

describe('creerEspece', () => {
  it('écrit une fiche relisible avec la date du jour', async () => {
    await creerEspece(racine, 'faune', fiche)
    const [e] = await listerEspeces(racine)
    expect(e).toMatchObject({ categorie: 'faune', slug: 'vulpes-vulpes', photos: [] })
    expect(e.fiche).toMatchObject(fiche)
    expect(e.fiche.ajoute).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('détecte une espèce existante malgré casse et espaces, sans rien modifier', async () => {
    await creerEspece(racine, 'faune', { ...fiche, nomScientifique: 'Vulpes  vulpes' })
    const avant = await readFile(join(racine, 'faune/vulpes-vulpes/fiche.md'), 'utf8')
    const r = await creerEspece(racine, 'flore', { ...fiche, nomScientifique: 'vulpes vulpes', nomCommun: 'Autre' })
    expect(r.existait).toBe(true)
    expect(r.espece.categorie).toBe('faune')
    expect(await readFile(join(racine, 'faune/vulpes-vulpes/fiche.md'), 'utf8')).toBe(avant)
  })

  it('refuse une catégorie hors liste', async () => {
    await expect(creerEspece(racine, '../x' as any, fiche)).rejects.toThrow('Chemin interdit')
  })

  it('refuse un groupe qui ne correspond pas à la catégorie', async () => {
    await expect(creerEspece(racine, 'flore', fiche)).rejects.toThrow('Groupe invalide')
  })
})

describe('ajouterPhoto', () => {
  beforeEach(async () => { await creerEspece(racine, 'faune', fiche) })

  it('réduit à 2500 px de côté maximum', async () => {
    const { nom } = await ajouterPhoto(racine, 'faune', 'vulpes-vulpes', 'grande.jpg', await jpeg(3000, 2000))
    const meta = await sharp(join(racine, 'faune/vulpes-vulpes', nom)).metadata()
    expect([meta.width, meta.height]).toEqual([2500, 1667])
  })

  it('assainit et rend unique le nom de fichier', async () => {
    const a = await ajouterPhoto(racine, 'faune', 'vulpes-vulpes', 'Photo.JPG', await jpeg())
    const b = await ajouterPhoto(racine, 'faune', 'vulpes-vulpes', 'Photo.JPG', await jpeg())
    expect([a.nom, b.nom]).toEqual(['photo.jpg', 'photo-2.jpg'])
    expect((await listerEspeces(racine))[0].photos).toEqual(['photo-2.jpg', 'photo.jpg'])
  })

  it.each([
    ['IMG_1234.CR3', Buffer.from('raw')],
    ['IMG_1234.HEIC', Buffer.from('heic')],
    ['x.jpg', Buffer.from('pas une image')],
  ])('refuse %s', async (nom, contenu) => {
    await expect(ajouterPhoto(racine, 'faune', 'vulpes-vulpes', nom, contenu)).rejects.toThrow('Format non pris en charge')
  })

  it('enregistre le GPS dans la fiche et le retire de la photo publiée', async () => {
    const avecGps = await sharp({ create: { width: 20, height: 20, channels: 3, background: '#fff' } }).jpeg()
      .withExif({ IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '13/1 41/1 24/1', GPSLongitudeRef: 'E', GPSLongitude: '100/1 33/1 36/1' } })
      .toBuffer()
    const r = await ajouterPhoto(racine, 'faune', 'vulpes-vulpes', 'gps.jpg', avecGps)
    expect(r.coordonnees).toEqual([13.69, 100.56])
    expect((await listerEspeces(racine))[0].fiche.coordonnees).toEqual([13.69, 100.56])
    expect(await exifr.gps(join(racine, 'faune/vulpes-vulpes', r.nom))).toBeUndefined()
  })

  it('enregistre la date de prise de vue de la première photo datée', async () => {
    const datee = (d: string) => sharp({ create: { width: 20, height: 20, channels: 3, background: '#fff' } }).jpeg()
      .withExif({ IFD2: { DateTimeOriginal: d } }).toBuffer()
    await ajouterPhoto(racine, 'faune', 'vulpes-vulpes', 'a.jpg', await datee('2023:03:08 23:50:00'))
    await ajouterPhoto(racine, 'faune', 'vulpes-vulpes', 'b.jpg', await datee('2024:01:01 10:00:00'))
    expect((await listerEspeces(racine))[0].fiche.dateObservation).toBe('2023-03-08')
  })

  it('refuse une espèce inexistante', async () => {
    await expect(ajouterPhoto(racine, 'faune', 'inconnue', 'a.jpg', await jpeg())).rejects.toThrow('Espèce introuvable')
  })
})

describe('modifier, retirer, supprimer', () => {
  beforeEach(async () => { await creerEspece(racine, 'faune', fiche) })

  it('modifierFiche ne change que les champs donnés', async () => {
    const f = await modifierFiche(racine, 'faune', 'vulpes-vulpes', { nomCommun: 'Renard' })
    expect(f).toMatchObject({ ...fiche, nomCommun: 'Renard' })
  })

  it('garde la description (texte sous le frontmatter) et les infos détaillées', async () => {
    const description = 'Observé sur un bambou.\n\nTrès peu farouche — « ligne 2 ».'
    await modifierFiche(racine, 'faune', 'vulpes-vulpes', { description, taille: '12–20 cm', statutUicn: 'LC' })
    const texte = await readFile(join(racine, 'faune/vulpes-vulpes/fiche.md'), 'utf8')
    expect(texte).toMatch(/---\n\nObservé sur un bambou\.\n\nTrès peu farouche — « ligne 2 »\.\n$/)
    expect((await listerEspeces(racine))[0].fiche).toMatchObject({ description, taille: '12–20 cm', statutUicn: 'LC' })
  })

  it('un champ vidé disparaît de la fiche', async () => {
    await modifierFiche(racine, 'faune', 'vulpes-vulpes', { habitat: 'Forêts', description: 'Texte' })
    await modifierFiche(racine, 'faune', 'vulpes-vulpes', { habitat: '', description: '' })
    const f = (await listerEspeces(racine))[0].fiche
    expect(f.habitat).toBeUndefined()
    expect(f.description).toBeUndefined()
  })

  it('refuse un statut UICN inconnu et une date mal formée', async () => {
    await expect(modifierFiche(racine, 'faune', 'vulpes-vulpes', { statutUicn: 'XX' })).rejects.toThrow('Statut UICN invalide')
    await expect(modifierFiche(racine, 'faune', 'vulpes-vulpes', { dateObservation: '08/03/2023' })).rejects.toThrow('Date invalide')
  })

  it('retirerPhoto refuse de sortir du dossier', async () => {
    await expect(retirerPhoto(racine, 'faune', 'vulpes-vulpes', '../fiche.md')).rejects.toThrow('Chemin interdit')
    await expect(retirerPhoto(racine, 'faune', 'vulpes-vulpes', 'fiche.md')).rejects.toThrow('Chemin interdit')
  })

  it('retirerPhoto puis supprimerEspece', async () => {
    const { nom } = await ajouterPhoto(racine, 'faune', 'vulpes-vulpes', 'a.jpg', await jpeg())
    await retirerPhoto(racine, 'faune', 'vulpes-vulpes', nom)
    expect((await listerEspeces(racine))[0].photos).toEqual([])
    await supprimerEspece(racine, 'faune', 'vulpes-vulpes')
    expect(await listerEspeces(racine)).toEqual([])
  })
})
