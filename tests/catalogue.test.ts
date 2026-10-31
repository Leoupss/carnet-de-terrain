import { it, expect } from 'vitest'
import { regrouperPhotos, ordonner } from '../src/lib/regrouper'

it('ordonner : éléments cités d’abord, puis les autres ; noms inconnus ignorés', () => {
  expect(ordonner(['a', 'b', 'c', 'd'], (x) => x, ['c', 'zz', 'a'])).toEqual(['c', 'a', 'b', 'd'])
  expect(ordonner(['a', 'b'], (x) => x)).toEqual(['a', 'b'])
})

const img = (src: string) => ({ src, width: 1, height: 1, format: 'jpg' }) as any

it('regroupe les photos par espèce, triées par nom', () => {
  const A = img('a'), B = img('b'), X = img('x')
  const g = regrouperPhotos({
    '/src/content/especes/faune/vulpes-vulpes/b.jpg': B,
    '/src/content/especes/faune/vulpes-vulpes/a.jpg': A,
    '/src/content/especes/flore/papaver-rhoeas/x.webp': X,
  })
  expect(g.get('faune/vulpes-vulpes')).toEqual([{ nom: 'a.jpg', image: A }, { nom: 'b.jpg', image: B }])
  expect(g.get('flore/papaver-rhoeas')).toEqual([{ nom: 'x.webp', image: X }])
  expect(g.has('faune/sans-photo')).toBe(false)
})
