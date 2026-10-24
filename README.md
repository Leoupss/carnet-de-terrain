# Carnet de terrain

Portfolio naturaliste de Léo LUCAS : catalogue des espèces photographiées (faune, flore).

## Ajouter des photos

1. `npm run dev`
2. Ouvrir <http://localhost:4321/admin/>
3. **Ajouter** : chercher l'espèce (GBIF remplit le nom français et le groupe), déposer les photos, Enregistrer.
4. **Mon catalogue** : corriger un nom ou un groupe, retirer une photo, supprimer une espèce.
5. **Publier** : envoie les changements sur GitHub ; Cloudflare Pages met le site en ligne à jour en quelques minutes.

Formats acceptés : JPG, PNG, WebP (les RAW `.CR3` et les `.HEIC` doivent être exportés en JPG).
Les photos sont réduites à 2500 px et leurs métadonnées (dont le GPS) sont retirées ; les coordonnées GPS
éventuelles sont gardées dans la fiche, non affichées, pour un futur globe.

L'admin n'existe qu'en local : elle n'est jamais incluse dans le site publié (`npm run build` le vérifie).

## Développement

- `npm test` — tests (Vitest)
- `npm run build` — génère `dist/` et vérifie l'absence de l'admin
- Contenu : `src/content/especes/<faune|flore>/<nom-scientifique>/fiche.md` + photos
- Ajouter une catégorie (ex. minéraux) : `src/lib/categories.ts`
