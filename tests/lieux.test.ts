import { it, expect } from 'vitest'
import { regrouperLieux } from '../src/lib/lieux'

const espece = (slug: string, data: Record<string, unknown>) =>
  ({ categorie: 'faune' as const, slug, data: { nomCommun: slug, nomScientifique: `${slug} sci`, ...data } })

it('groupe par position arrondie à ~10 km, GPS prioritaire, sans position ignorée', () => {
  const points = regrouperLieux([
    espece('anolis', { lieu: 'Jardin de Balata, Martinique', positionLieu: [14.67105, -61.09197] }),
    espece('colibri', { lieu: 'Balata', coordonnees: [14.6702, -61.0899], positionLieu: [0, 0] }),
    espece('renard', { lieu: 'Jura', positionLieu: [46.7, 5.9] }),
    espece('sans', { lieu: 'Quelque part' }),
  ])
  expect(points).toEqual([
    {
      nom: 'Jardin de Balata · Balata',
      position: [14.7, -61.1],
      especes: [
        { nom: 'anolis', sci: 'anolis sci', url: '/faune/anolis/' },
        { nom: 'colibri', sci: 'colibri sci', url: '/faune/colibri/' },
      ],
    },
    { nom: 'Jura', position: [46.7, 5.9], especes: [{ nom: 'renard', sci: 'renard sci', url: '/faune/renard/' }] },
  ])
})

it('libellés proches d’un même lieu : noms courts sans doublon', () => {
  const [p] = regrouperLieux([
    espece('a', { lieu: 'Bang Kachao, Bangkok', positionLieu: [13.69, 100.56] }),
    espece('b', { lieu: 'Bang Kachao, Bangkok, Thaïlande', positionLieu: [13.69, 100.56] }),
    espece('c', { lieu: 'Benchakiti Park, Bangkok', positionLieu: [13.72, 100.55] }),
  ])
  expect(p.nom).toBe('Bang Kachao · Benchakiti Park')
})

it('un seul libellé : gardé en entier', () => {
  expect(regrouperLieux([espece('a', { lieu: 'Jardin de Balata, Martinique', positionLieu: [14.6, -61] })])[0].nom)
    .toBe('Jardin de Balata, Martinique')
})

it('sans lieu nommé', () => {
  expect(regrouperLieux([espece('x', { coordonnees: [1, 2] })])[0].nom).toBe('Lieu d’observation')
})
