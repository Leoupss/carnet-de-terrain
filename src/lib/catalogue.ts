import { getCollection, type CollectionEntry } from 'astro:content'
import type { ImageMetadata } from 'astro'
import type { Categorie } from './categories'
import { regrouperPhotos, type Photo } from './regrouper'

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

/** Photos cochées « coup de cœur » dans l'admin, avec leur espèce. */
export async function getCoupsDeCoeur(): Promise<{ espece: Espece; photo: Photo; legende?: string }[]> {
  return (await getEspeces()).flatMap((espece) =>
    espece.photos
      .filter((photo) => espece.data.photos?.[photo.nom]?.coupDeCoeur)
      .map((photo) => ({ espece, photo, legende: espece.data.photos?.[photo.nom]?.legende })),
  )
}

export async function getEspeces(categorie?: Categorie): Promise<Espece[]> {
  const entrees = await getCollection('especes')
  return entrees
    .map((e) => {
      const [cat, slug] = e.id.split('/') as [Categorie, string]
      return { categorie: cat, slug, data: e.data, photos: photos.get(e.id) ?? [], entree: e }
    })
    // Une fiche sans photo (envoi interrompu) reste invisible.
    .filter((e) => e.photos.length > 0 && (!categorie || e.categorie === categorie))
    .sort((a, b) => a.data.nomCommun.localeCompare(b.data.nomCommun, 'fr'))
}
