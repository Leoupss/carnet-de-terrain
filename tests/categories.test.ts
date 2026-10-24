import { it, expect } from 'vitest'
import { classerDepuisGbif } from '../src/lib/categories'

it.each([
  [{ kingdom: 'Animalia', class: 'Aves' }, { categorie: 'faune', groupe: 'Oiseaux' }],
  [{ kingdom: 'Animalia', class: 'Insecta' }, { categorie: 'faune', groupe: 'Insectes' }],
  [{ kingdom: 'Animalia', class: 'Arachnida' }, { categorie: 'faune', groupe: 'Arachnides' }],
  [{ kingdom: 'Animalia', class: 'Mammalia' }, { categorie: 'faune', groupe: 'Mammifères' }],
  [{ kingdom: 'Animalia', class: 'Squamata' }, { categorie: 'faune', groupe: 'Reptiles' }],
  [{ kingdom: 'Animalia', class: 'Amphibia' }, { categorie: 'faune', groupe: 'Amphibiens' }],
  [{ kingdom: 'Animalia', class: 'Actinopterygii' }, { categorie: 'faune', groupe: 'Poissons' }],
  [{ kingdom: 'Animalia', class: 'Gastropoda' }, { categorie: 'faune', groupe: 'Autres' }],
  [{ kingdom: 'Fungi' }, { categorie: 'flore', groupe: 'Champignons' }],
  [{ kingdom: 'Plantae', class: 'Magnoliopsida' }, { categorie: 'flore', groupe: 'Fleurs' }],
  [{ kingdom: 'Plantae', class: 'Polypodiopsida' }, { categorie: 'flore', groupe: 'Plantes' }],
])('%o → %o', (c, attendu) => expect(classerDepuisGbif(c)).toEqual(attendu))

it('règne inconnu → null', () => expect(classerDepuisGbif({ kingdom: 'Bacteria' })).toBeNull())
