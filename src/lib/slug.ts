export function slugify(texte: string): string {
  const slug = texte
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (!slug) throw new Error('Nom invalide')
  return slug
}

export function assainirNomFichier(nom: string): string {
  const point = nom.lastIndexOf('.')
  if (point <= 0) return slugify(nom)
  return `${slugify(nom.slice(0, point))}.${nom.slice(point + 1).toLowerCase()}`
}
