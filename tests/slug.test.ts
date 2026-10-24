import { describe, it, expect } from 'vitest'
import { slugify, assainirNomFichier } from '../src/lib/slug'

describe('slugify', () => {
  it('met en minuscules avec des tirets', () => expect(slugify('Vulpes vulpes')).toBe('vulpes-vulpes'))
  it('ignore casse et espaces multiples', () => expect(slugify('  Vulpes  VULPES ')).toBe('vulpes-vulpes'))
  it('retire la ponctuation', () => expect(slugify('Atractomorpha sp.')).toBe('atractomorpha-sp'))
  it('retire les accents', () => expect(slugify('Pétunia')).toBe('petunia'))
  it('refuse un nom vide', () => expect(() => slugify('…')).toThrow('Nom invalide'))
})

describe('assainirNomFichier', () => {
  it('extension en minuscules', () => expect(assainirNomFichier('IMG_0001.JPG')).toBe('img-0001.jpg'))
  it('espaces et accents', () => expect(assainirNomFichier('Renard roux é.jpeg')).toBe('renard-roux-e.jpeg'))
  it('nom sans extension', () => expect(assainirNomFichier('photo')).toBe('photo'))
})
