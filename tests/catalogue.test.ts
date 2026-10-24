import { it, expect } from 'vitest'
import { regrouperPhotos } from '../src/lib/regrouper'

const img = (src: string) => ({ src, width: 1, height: 1, format: 'jpg' }) as any

it('regroupe les photos par espèce, triées par nom', () => {
  const A = img('a'), B = img('b'), X = img('x')
  const g = regrouperPhotos({
    '/src/content/especes/faune/vulpes-vulpes/b.jpg': B,
    '/src/content/especes/faune/vulpes-vulpes/a.jpg': A,
    '/src/content/especes/flore/papaver-rhoeas/x.webp': X,
  })
  expect(g.get('faune/vulpes-vulpes')).toEqual([A, B])
  expect(g.get('flore/papaver-rhoeas')).toEqual([X])
  expect(g.has('faune/sans-photo')).toBe(false)
})
