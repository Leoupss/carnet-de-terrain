import { getCollection, type CollectionEntry } from 'astro:content'
import type { ImageMetadata } from 'astro'
import type { Categorie } from './categories'
import { regrouperPhotos, ordonner, type Photo } from './regrouper'

export type Espece = {
  categorie: Categorie
  slug: string
  data: CollectionEntry<'especes'>['data']
  photos: Photo[]
  /** Pour `render(espece.entree)` : la description écrite sous le frontmatter. */
  entree: CollectionEntry<'especes'>
}

const photos = regrouperPhotos(
  import.meta.glob<ImageMetadata>('/src/content/especes/**/*.{jpg,jpeg,png,webp}', { eager: true, import: 'default' }),
)

// Liste ordonnée « categorie/slug/photo » réglée dans l'admin (onglet Coups de cœur) ; absente tant qu'aucune photo n'est cochée.
const listeCoeurs = Object.values(
  import.meta.glob<string[]>('/src/content/especes/coups-de-coeur.json', { eager: true, import: 'default' }),
)[0] ?? []

/** Photos coups de cœur, dans l'ordre choisi dans l'admin. */
export async function getCoupsDeCoeur(): Promise<{ espece: Espece; photo: Photo; legende?: string }[]> {
  const especes = await getEspeces()
  return listeCoeurs.flatMap((id) => {
    const [cat, slug, nom] = id.split('/')
    const espece = especes.find((e) => e.categorie === cat && e.slug === slug)
    const photo = espece?.photos.find((p) => p.nom === nom)
    return espece && photo ? [{ espece, photo, legende: espece.data.photos?.[nom]?.legende }] : []
  })
}

export async function getEspeces(categorie?: Categorie): Promise<Espece[]> {
  const entrees = await getCollection('especes')
  return entrees
    .map((e) => {
      const [cat, slug] = e.id.split('/') as [Categorie, string]
      // Ordre choisi dans l'admin : la première photo est la principale (carte, fiche, mosaïque).
      const liste = ordonner(photos.get(e.id) ?? [], (p) => p.nom, e.data.ordre)
      return { categorie: cat, slug, data: e.data, photos: liste, entree: e }
    })
    // Une fiche sans photo (envoi interrompu) reste invisible.
    .filter((e) => e.photos.length > 0 && (!categorie || e.categorie === categorie))
    .sort((a, b) => a.data.nomCommun.localeCompare(b.data.nomCommun, 'fr'))
}
