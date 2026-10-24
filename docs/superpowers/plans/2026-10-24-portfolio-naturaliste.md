# Portfolio naturaliste — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** site Astro statique de catalogue d'espèces (faune/flore), plus une interface locale `/admin` pour ajouter, corriger, retirer et publier sans toucher aux fichiers ni à Git.

**Architecture :** le site public est généré par Astro à partir de `src/content/especes/<categorie>/<slug>/fiche.md` et des images du même dossier. L'admin n'est **pas** une page Astro : c'est un middleware enregistré par une intégration Astro dans le hook `astro:server:setup`, qui n'existe qu'en `astro dev` et ne peut donc jamais se retrouver dans `dist/`. Il sert une page HTML et vanilla JS, plus une API JSON qui écrit sur le disque, appelle GBIF et lance Git.

**Tech Stack :** Astro 5, TypeScript, Vitest, `sharp` (fourni avec Astro), `exifr` (lecture du GPS), `yaml` (écriture du frontmatter). Pas de framework d'interface.

**Spec :** `docs/superpowers/specs/2026-10-24-portfolio-naturaliste-design.md`

## Global Constraints

- Tous les textes visibles sont en français.
- Catégories autorisées : `faune`, `flore` (la liste est un tableau unique, `CATEGORIES`, pour ajouter `mineraux` plus tard).
- Groupes Faune : Oiseaux, Insectes, Arachnides, Mammifères, Reptiles, Amphibiens, Poissons, Autres. Groupes Flore : Fleurs, Plantes, Champignons, Autres.
- Champs de `fiche.md` : `nomScientifique` (requis), `nomCommun` (requis), `groupe` (requis), `ajoute` (date ISO, requise), `lieu`, `coordonnees: [lat, lon]`, `gbifKey` (facultatifs).
- Photos acceptées : jpg, jpeg, png, webp. Réduction à 2500 px maximum de côté à l'enregistrement, avec `rotate()` pour respecter l'orientation EXIF. Les métadonnées sont retirées par sharp, donc le GPS n'est pas publié (souhaitable pour les espèces sensibles).
- Palette : `--cream #F7F4EC`, `--cream-dark #D5CDBA`, `--green-forest #2C5F2E`, `--green-mid #4A7C59`, `--brown-earth #7B4F2E`, `--gold #C4993A`, `--text-dark #1C1B18`, `--text-muted #8A7F72`. Titres en EB Garamond (Google Fonts), texte en police système. Fond clair uniquement.
- Accessibilité : texte alternatif = « {nomCommun} ({nomScientifique}) », lightbox utilisable au clavier, contraste WCAG AA.
- Aucune écriture hors de `src/content/especes/`. Aucun fichier existant n'est écrasé.
- Requêtes d'API qui modifient quelque chose : refusées si l'en-tête `Origin` n'est pas `http://localhost:*` ou `http://127.0.0.1:*` (protection contre un site tiers qui viserait l'admin locale).

## Review Focus

1. **Fichiers RAW ou HEIC** (`.CR3` du Canon 90D, `.HEIC` d'un téléphone) déposés dans l'admin : refus clair « format non pris en charge, exporte en JPG », sans plantage (test en tâche 5).
2. **Noms de fichiers bizarres** (`IMG_0001.JPG`, `Renard roux é.jpeg`, deux fois `photo.jpg`) : le nom est assaini en minuscules et reste unique (`photo.jpg`, puis `photo-2.jpg`) (test en tâche 5).
3. **Espèce sans photo** (fiche créée, mais l'envoi a échoué) : la construction réussit et l'espèce n'apparaît pas sur le site public (test en tâche 3).
4. **Commit réussi mais push échoué** (hors connexion) : au prochain « Publier », le commit en attente est poussé même s'il n'y a plus rien de nouveau à committer (test en tâche 7).
5. **Même espèce saisie avec une casse ou des espaces différents** (`Vulpes  vulpes`, `vulpes vulpes`) : même slug, donc espèce existante détectée et pas de doublon (test en tâche 2 et en tâche 5).

---

## Structure des fichiers

```
astro.config.mjs            intégration admin + config
package.json  tsconfig.json  .gitignore  vitest.config.ts
src/
  content.config.ts         collection "especes" + schéma zod
  lib/categories.ts         CATEGORIES, GROUPES, groupeDepuisClassification()
  lib/slug.ts               slugify(), assainirNomFichier()
  lib/catalogue.ts          getEspeces(), regrouperPhotos()
  styles/global.css
  layouts/Base.astro
  components/CarteEspece.astro
  pages/index.astro  pages/a-propos.md
  pages/[categorie]/index.astro  pages/[categorie]/[slug].astro
  content/especes/.gitkeep
admin/
  integration.ts            hook astro:server:setup → middleware /admin
  api.ts                    routage + handlers HTTP, vérification Origin
  fichiers.ts               opérations disque (fiches, photos)
  gbif.ts                   suggestions + détails d'espèce
  publier.ts                résumé des changements, commit, push
  ui/index.html  ui/admin.js  ui/admin.css
scripts/verifier-build.mjs  échoue si dist/ contient « admin »
tests/*.test.ts
```

---

### Task 1 : Squelette Astro, thème et mise en page

**Files :**
- Create : `package.json`, `astro.config.mjs`, `tsconfig.json`, `vitest.config.ts`, `.gitignore`, `src/styles/global.css`, `src/layouts/Base.astro`, `src/pages/index.astro` (provisoire), `src/pages/a-propos.md`, `src/content/especes/.gitkeep`, `scripts/verifier-build.mjs`

**Interfaces :**
- Produces : `Base.astro` avec les props `{ titre: string; description?: string }` et un `<slot />`. L'en-tête contient la navigation Accueil / Faune / Flore / À propos. Scripts npm : `dev`, `build` (= `astro build && node scripts/verifier-build.mjs`), `test` (= `vitest run`).

- [ ] **Step 1 :** `git init`, puis créer le projet avec `npm create astro@latest -- --template minimal --typescript strict --no-install --no-git .` et `npm i`, puis `npm i yaml exifr` et `npm i -D vitest`.
- [ ] **Step 2 :** `.gitignore` = `node_modules/`, `dist/`, `.astro/`.
- [ ] **Step 3 :** `global.css` : les variables de couleur des Global Constraints, une mise en page centrée de 1200 px maximum, des marges de 1.5rem (16px minimum sur mobile), des titres en EB Garamond, et une classe `.grille` en `grid-template-columns: repeat(auto-fill, minmax(220px, 1fr))`.
- [ ] **Step 4 :** `Base.astro` : `<html lang="fr">`, le lien Google Fonts EB Garamond 400/500 et l'italique, l'en-tête et un pied de page « © Léo LUCAS ». `a-propos.md` utilise `layout: ../layouts/Base.astro` avec un court texte à compléter par Léo.
- [ ] **Step 5 :** `scripts/verifier-build.mjs` : parcourt `dist/` récursivement et s'arrête avec le code 1 et le message `Fuite admin : <chemin>` si un chemin contient `admin`.
- [ ] **Step 6 :** lancer `npm run build`. Attendu : la construction réussit et le script ne signale rien.
- [ ] **Step 7 :** commit `chore: squelette Astro et thème naturaliste`.

### Task 2 : Slugs et groupes

**Files :** Create : `src/lib/slug.ts`, `src/lib/categories.ts`. Test : `tests/slug.test.ts`, `tests/categories.test.ts`

**Interfaces :**
- Produces :
  - `slugify(texte: string): string` : minuscules, accents retirés (NFD), tout ce qui n'est pas `[a-z0-9]` remplacé par `-`, tirets en double et en bordure retirés. Lève une `Error('Nom invalide')` si le résultat est vide.
  - `assainirNomFichier(nom: string): string` : applique `slugify` à la base du nom et met l'extension en minuscules (`IMG_0001.JPG` → `img-0001.jpg`).
  - `CATEGORIES = ['faune', 'flore'] as const` ; `type Categorie`.
  - `GROUPES: Record<Categorie, string[]>` (les valeurs des Global Constraints).
  - `classerDepuisGbif(c: { kingdom?: string; class?: string }): { categorie: Categorie; groupe: string } | null`

- [ ] **Step 1 : écrire les tests qui échouent**

```ts
expect(slugify('Vulpes vulpes')).toBe('vulpes-vulpes')
expect(slugify('  Vulpes  VULPES ')).toBe('vulpes-vulpes')
expect(slugify('Atractomorpha sp.')).toBe('atractomorpha-sp')
expect(() => slugify('…')).toThrow('Nom invalide')
expect(assainirNomFichier('IMG_0001.JPG')).toBe('img-0001.jpg')
expect(assainirNomFichier('Renard roux é.jpeg')).toBe('renard-roux-e.jpeg')
expect(classerDepuisGbif({ kingdom: 'Animalia', class: 'Aves' })).toEqual({ categorie: 'faune', groupe: 'Oiseaux' })
expect(classerDepuisGbif({ kingdom: 'Animalia', class: 'Squamata' })).toEqual({ categorie: 'faune', groupe: 'Reptiles' })
expect(classerDepuisGbif({ kingdom: 'Animalia', class: 'Gastropoda' })).toEqual({ categorie: 'faune', groupe: 'Autres' })
expect(classerDepuisGbif({ kingdom: 'Fungi' })).toEqual({ categorie: 'flore', groupe: 'Champignons' })
expect(classerDepuisGbif({ kingdom: 'Plantae', class: 'Magnoliopsida' })).toEqual({ categorie: 'flore', groupe: 'Fleurs' })
expect(classerDepuisGbif({ kingdom: 'Plantae', class: 'Polypodiopsida' })).toEqual({ categorie: 'flore', groupe: 'Plantes' })
expect(classerDepuisGbif({ kingdom: 'Bacteria' })).toBeNull()
```

- [ ] **Step 2 :** lancer `npx vitest run tests/slug.test.ts tests/categories.test.ts`. Attendu : FAIL (modules introuvables).
- [ ] **Step 3 :** implémenter. Correspondance des classes GBIF : Aves → Oiseaux ; Insecta → Insectes ; Arachnida → Arachnides ; Mammalia → Mammifères ; Reptilia, Squamata, Testudines et Crocodylia → Reptiles ; Amphibia → Amphibiens ; Actinopterygii et Chondrichthyes → Poissons ; autre classe animale → Autres. Règne Fungi → flore / Champignons ; Plantae avec Magnoliopsida ou Liliopsida → Fleurs ; autre plante → Plantes.
- [ ] **Step 4 :** relancer les tests. Attendu : PASS.
- [ ] **Step 5 :** commit `feat: slugs et classement GBIF`.

### Task 3 : Collection de contenu et catalogue

**Files :** Create : `src/content.config.ts`, `src/lib/catalogue.ts`. Test : `tests/catalogue.test.ts`

**Interfaces :**
- Consumes : `CATEGORIES`, `GROUPES` (tâche 2).
- Produces :
  - La collection `especes`, définie par `glob({ pattern: '**/fiche.md', base: './src/content/especes' })`. Schéma zod : les champs des Global Constraints, avec `ajoute: z.coerce.date()` et `coordonnees: z.tuple([z.number(), z.number()]).optional()`.
  - `type Espece = { categorie: Categorie; slug: string; data: <données du schéma>; photos: ImageMetadata[] }`
  - `regrouperPhotos(modules: Record<string, ImageMetadata>): Map<string, ImageMetadata[]>` : la clé est `"<categorie>/<slug>"`, les photos sont triées par nom de fichier.
  - `getEspeces(categorie?: Categorie): Promise<Espece[]>` : fusionne la collection et `import.meta.glob('/src/content/especes/**/*.{jpg,jpeg,png,webp}', { eager: true, import: 'default' })`. **Les espèces sans photo sont exclues.** Le résultat est trié par `nomCommun` avec `localeCompare('fr')`.

- [ ] **Step 1 : tests de `regrouperPhotos` (fonction pure, sans Astro)**

```ts
const m = { '/src/content/especes/faune/vulpes-vulpes/b.jpg': B, '/src/content/especes/faune/vulpes-vulpes/a.jpg': A,
            '/src/content/especes/flore/papaver-rhoeas/x.webp': X }
const g = regrouperPhotos(m)
expect(g.get('faune/vulpes-vulpes')).toEqual([A, B])
expect(g.get('flore/papaver-rhoeas')).toEqual([X])
expect(g.has('faune/sans-photo')).toBe(false)
```

- [ ] **Step 2 :** lancer les tests. Attendu : FAIL. **Step 3 :** implémenter. **Step 4 :** relancer. Attendu : PASS.
- [ ] **Step 5 (Review Focus 3) :** créer temporairement `src/content/especes/faune/test-vide/fiche.md`, une fiche valide sans photo, puis lancer `npm run build`. Attendu : la construction réussit et aucune page `faune/test-vide` n'est générée. Supprimer ensuite ce dossier.
- [ ] **Step 6 :** commit `feat: collection espèces et catalogue`.

### Task 4 : Pages publiques

**Files :** Create : `src/components/CarteEspece.astro`, `src/pages/[categorie]/index.astro`, `src/pages/[categorie]/[slug].astro`. Modify : `src/pages/index.astro`

**Interfaces :**
- Consumes : `getEspeces`, `Espece`, `CATEGORIES`, `GROUPES`, `Base.astro`.

- [ ] **Step 1 :** `CarteEspece.astro`, props `{ espece: Espece }` : un lien vers `/{categorie}/{slug}/` avec `<Image>` (première photo, `width={440}`, `loading="lazy"`), le nom commun et le nom scientifique en `<em>`. Attributs `data-nom` (les deux noms en minuscules) et `data-groupe` pour le filtre.
- [ ] **Step 2 :** `[categorie]/index.astro` : `getStaticPaths` génère une page par élément de `CATEGORIES`. Titre « Faune » ou « Flore » avec le nombre d'espèces. Boutons de filtre « Tous » plus un bouton par groupe **présent**. Un `<input type="search">` « Rechercher une espèce ». Un `<script>` inline masque les cartes (`hidden`) qui ne correspondent pas au filtre de groupe ET au texte, et affiche « Aucune espèce trouvée » si rien ne correspond.
- [ ] **Step 3 :** `[categorie]/[slug].astro` : une page par espèce. `<h1>` avec le nom commun, puis le nom scientifique en `<em>`, puis le groupe en petit. Une galerie de `<Image width={800}>`, chacune dans un `<button>` qui ouvre une `<dialog>` lightbox. Celle-ci affiche une image `getImage({ width: 2000 })`, se pilote avec ← et →, se ferme avec Échap (comportement natif de `<dialog>`), et réagit au balayage tactile (seuil de 50 px). Le focus revient sur la vignette à la fermeture.
- [ ] **Step 4 :** `index.astro` : l'accroche « Carnet de terrain », puis le titre « Observations de la *nature* ». Une bande « Récemment ajoutées » montre la première photo des 6 espèces les plus récentes (selon `ajoute`) ; elle est masquée si le catalogue est vide. Deux cartes, Faune et Flore, indiquent « N espèces ». Un `<div id="globe"></div>` vide est prévu pour plus tard.
- [ ] **Step 5 : vérification visuelle.** Créer temporairement deux espèces (une en faune, une en flore, avec 2 photos chacune), lancer `npm run dev`, puis vérifier dans le navigateur, sur ordinateur et à 375 px de large : l'accueil, le filtre et la recherche, la fiche, la lightbox au clavier, et l'absence de défilement horizontal. Lancer `npm run build`. Attendu : la construction réussit. Supprimer ensuite les espèces temporaires.
- [ ] **Step 6 :** commit `feat: pages publiques et lightbox`.

### Task 5 : Opérations sur les fichiers (admin)

**Files :** Create : `admin/fichiers.ts`. Test : `tests/fichiers.test.ts` (chaque test travaille dans un dossier temporaire créé avec `fs.mkdtemp`).

**Interfaces :**
- Consumes : `slugify`, `assainirNomFichier`, `CATEGORIES`, `GROUPES`.
- Produces (chaque fonction reçoit `racine: string`, le chemin absolu de `src/content/especes`) :
  - `type Fiche = { nomScientifique: string; nomCommun: string; groupe: string; ajoute: string; lieu?: string; coordonnees?: [number, number]; gbifKey?: number }`
  - `type EspeceAdmin = { categorie: Categorie; slug: string; fiche: Fiche; photos: string[] }`
  - `listerEspeces(racine): Promise<EspeceAdmin[]>`
  - `creerEspece(racine, categorie, fiche: Omit<Fiche,'ajoute'>): Promise<{ espece: EspeceAdmin; existait: boolean }>` : si le slug existe déjà, que ce soit dans **n'importe quelle** catégorie, la fonction renvoie l'espèce existante avec `existait: true` sans rien modifier. Sinon elle crée le dossier et `fiche.md` avec `ajoute` = la date du jour.
  - `modifierFiche(racine, categorie, slug, champs: Partial<Pick<Fiche,'nomCommun'|'groupe'|'lieu'|'coordonnees'>>): Promise<Fiche>`
  - `ajouterPhoto(racine, categorie, slug, nomOriginal: string, contenu: Buffer): Promise<{ nom: string; coordonnees?: [number, number] }>` : la fonction refuse les extensions hors liste et les contenus que `sharp().metadata()` ne sait pas lire, avec une `Error('Format non pris en charge (JPG, PNG ou WebP uniquement) — exporte la photo en JPG')`. Elle lit le GPS avec `exifr.gps(contenu)`, puis réduit avec `sharp(contenu).rotate().resize(2500, 2500, { fit: 'inside', withoutEnlargement: true })` en gardant le format. Le nom de fichier final est rendu unique (`-2`, `-3`, etc.). Si la fiche n'a pas encore de `coordonnees` et que le GPS existe, elles y sont enregistrées.
  - `retirerPhoto(racine, categorie, slug, nom): Promise<void>`
  - `supprimerEspece(racine, categorie, slug): Promise<void>`
  - Toutes les fonctions lèvent une `Error('Chemin interdit')` si la catégorie n'est pas dans `CATEGORIES`, si le slug ou le nom ne correspondent pas à `/^[a-z0-9]+(-[a-z0-9]+)*(\.[a-z]+)?$/`, ou si le chemin résolu sort de `racine`.
  - Le frontmatter s'écrit en `---\n${YAML.stringify(fiche)}---\n` ; les champs `undefined` sont omis.

- [ ] **Step 1 : écrire les tests qui échouent**, un par comportement :
  - `creerEspece` écrit un `fiche.md` relisible par `listerEspeces`, avec `ajoute` au format `AAAA-MM-JJ`.
  - `creerEspece` deux fois avec `'Vulpes  vulpes'` puis `'vulpes vulpes'` : la 2ᵉ renvoie `existait: true` et le contenu de `fiche.md` reste identique.
  - `ajouterPhoto` avec un JPEG de 3000×2000 généré par sharp : le fichier écrit fait 2500×1667.
  - `ajouterPhoto` deux fois avec `'Photo.JPG'` : les noms renvoyés sont `photo.jpg` puis `photo-2.jpg`.
  - `ajouterPhoto` avec `'IMG_1234.CR3'` (n'importe quel contenu) et avec `'x.jpg'` contenant `Buffer.from('pas une image')` : les deux rejettent avec le message « Format non pris en charge ».
  - `ajouterPhoto` avec un JPEG portant un GPS (fixture `tests/fixtures/gps.jpg`, générée par sharp avec `withExif`) : renvoie les `coordonnees`, la fiche les contient, et le fichier écrit ne contient plus de GPS (`exifr.gps` renvoie `undefined`).
  - `retirerPhoto(…, '../fiche.md')` et `creerEspece` avec la catégorie `'../x'` : rejettent avec « Chemin interdit ».
  - `modifierFiche` change `nomCommun` sans toucher aux autres champs.
- [ ] **Step 2 :** lancer `npx vitest run tests/fichiers.test.ts`. Attendu : FAIL. **Step 3 :** implémenter. **Step 4 :** relancer. Attendu : PASS.
- [ ] **Step 5 :** commit `feat(admin): opérations sur les fichiers`.

### Task 6 : Client GBIF

**Files :** Create : `admin/gbif.ts`. Test : `tests/gbif.test.ts` (avec `fetch` simulé par `vi.stubGlobal`).

**Interfaces :**
- Consumes : `classerDepuisGbif`.
- Produces :
  - `suggerer(q: string): Promise<{ key: number; nomScientifique: string; rang: string }[]>` : appelle `https://api.gbif.org/v1/species/suggest?q=…&limit=10` et renvoie `canonicalName` dans `nomScientifique`. Si `q` fait moins de 2 caractères, renvoie `[]` sans appel réseau.
  - `details(key: number): Promise<{ nomScientifique: string; nomCommun: string | null; categorie: Categorie | null; groupe: string | null; gbifKey: number }>` : appelle `/v1/species/{key}` et `/v1/species/{key}/vernacularNames?limit=100`. Le nom commun est le premier résultat en `language === 'fra'`, avec la première lettre en majuscule ; `null` s'il n'y en a pas.
  - Réponse HTTP non-OK ou erreur réseau : `Error('GBIF indisponible — saisis le nom à la main')`. Chaque appel est limité à 8 s avec `AbortSignal.timeout(8000)`.

- [ ] **Step 1 : tests.** (a) Une suggestion renvoie bien le `canonicalName`. (b) `details` trouve « renard roux » dans les noms `fra` et renvoie « Renard roux », `faune`, `Mammifères`. (c) Sans nom `fra`, renvoie `nomCommun: null`. (d) Avec un `fetch` qui rejette, l'erreur porte le message ci-dessus. (e) `suggerer('a')` n'appelle pas `fetch`.
- [ ] **Step 2 :** vérifier que les tests échouent, puis **Step 3 :** implémenter, puis **Step 4 :** vérifier qu'ils passent.
- [ ] **Step 5 :** commit `feat(admin): client GBIF`.

### Task 7 : Publication Git

**Files :** Create : `admin/publier.ts`. Test : `tests/publier.test.ts` (dans un dépôt temporaire avec un dépôt nu servant de `origin`).

**Interfaces :**
- Produces (toutes les commandes passent par `execFile('git', args, { cwd })`, sans shell) :
  - `resume(cwd): Promise<{ changements: { etat: 'ajouté' | 'modifié' | 'supprimé'; chemin: string }[]; commitsEnAttente: number }>` : s'appuie sur `git status --porcelain -- src/content/especes` et `git rev-list --count @{u}..HEAD` (0 si aucune branche amont).
  - `publier(cwd): Promise<{ commit: boolean; pousse: boolean }>` : s'il y a des changements, exécute `git add -- src/content/especes` puis `git commit -m "Catalogue : N fichier(s) mis à jour"`. Ensuite, si au moins un commit est en attente, exécute `git push`. S'il n'y a rien à faire du tout, renvoie `{ commit: false, pousse: false }`.
  - Erreur Git : `Error` dont le message contient le `stderr` de Git, précédé de « Échec de la publication : ».

- [ ] **Step 1 : tests.** (a) Un fichier ajouté apparaît dans `resume` avec l'état `ajouté`. (b) `publier` commit et pousse, puis `resume` est vide avec `commitsEnAttente: 0`. (c) **Review Focus 4 :** on retire l'`origin` (`git remote set-url origin /introuvable`) ; `publier` rejette mais le commit local existe. On remet l'`origin` ; `publier` renvoie `{ commit: false, pousse: true }`. (d) Un fichier hors de `src/content/especes` n'est pas committé.
- [ ] **Step 2 :** vérifier que les tests échouent, puis **Step 3 :** implémenter, puis **Step 4 :** vérifier qu'ils passent.
- [ ] **Step 5 :** commit `feat(admin): publication Git`.

### Task 8 : API locale et intégration Astro

**Files :** Create : `admin/api.ts`, `admin/integration.ts`. Modify : `astro.config.mjs`. Test : `tests/api.test.ts`

**Interfaces :**
- Consumes : les tâches 5, 6 et 7.
- Produces :
  - `origineAutorisee(origin: string | undefined, methode: string): boolean` : `GET` est toujours autorisé ; pour les autres méthodes, l'origine doit correspondre à `^http://(localhost|127\.0\.0\.1)(:\d+)?$`.
  - `creerMiddleware(opts: { racine: string; projet: string }): (req, res, next) => void` (signature connect / Vite).
  - `integrationAdmin(): AstroIntegration` : dans `astro:server:setup({ server })`, appelle `server.middlewares.use('/admin', creerMiddleware(...))`. Aucun autre hook.
  - Routes (réponses JSON ; erreur → `{ erreur: message }` avec 400, ou 502 pour GBIF, ou 500 pour Git) :

| Méthode et chemin (sous `/admin`) | Appelle |
|---|---|
| `GET /` , `/admin.js`, `/admin.css` | fichiers de `admin/ui/` |
| `GET /api/gbif/suggest?q=` | `suggerer` |
| `GET /api/gbif/espece/:key` | `details` |
| `GET /api/especes` | `listerEspeces` |
| `GET /api/especes/existe?nom=` | `{ existe: boolean, categorie?, slug? }` (slug calculé côté serveur avec `slugify`, pour éviter de le dupliquer dans `admin.js`) |
| `POST /api/especes` (JSON `{categorie, nomScientifique, nomCommun, groupe, lieu?, gbifKey?}`) | `creerEspece` |
| `PATCH /api/especes/:categorie/:slug` (JSON) | `modifierFiche` |
| `DELETE /api/especes/:categorie/:slug` | `supprimerEspece` |
| `POST /api/especes/:categorie/:slug/photos?nom=` (corps brut, 60 Mo max → 413) | `ajouterPhoto` |
| `DELETE /api/especes/:categorie/:slug/photos/:nom` | `retirerPhoto` |
| `GET /api/especes/:categorie/:slug/photos/:nom` | renvoie l'image (aperçu dans l'admin) |
| `GET /api/publier` / `POST /api/publier` | `resume` / `publier` |

  - `POST /api/especes` vérifie que `groupe` appartient à `GROUPES[categorie]` et que `nomCommun` n'est pas vide ; sinon il renvoie 400.

- [ ] **Step 1 : tests** (en appelant le middleware avec de faux objets `req`/`res` construits avec `node:stream` et un dossier temporaire) : (a) `origineAutorisee('https://evil.com','POST')` vaut false ; `('http://localhost:4321','POST')` vaut true ; `(undefined,'POST')` vaut false ; `(undefined,'GET')` vaut true. (b) Un `POST /api/especes` sans `Origin` renvoie 403. (c) Un `POST /api/especes` valide renvoie 200 et crée la fiche. (d) Un groupe invalide renvoie 400. (e) Une route inconnue renvoie 404.
- [ ] **Step 2 :** vérifier que les tests échouent, puis **Step 3 :** implémenter, puis **Step 4 :** vérifier qu'ils passent.
- [ ] **Step 5 :** ajouter `integrationAdmin()` dans `astro.config.mjs`. Lancer `npm run build`. Attendu : la construction réussit, `verifier-build` ne signale rien, et `dist/` ne contient aucun dossier `admin`.
- [ ] **Step 6 :** commit `feat(admin): API locale réservée au mode dev`.

### Task 9 : Interface d'administration

**Files :** Create : `admin/ui/index.html`, `admin/ui/admin.js`, `admin/ui/admin.css`

**Interfaces :**
- Consumes : les routes de la tâche 8. L'interface reprend les variables de couleur du site.

- [ ] **Step 1 : onglet « Ajouter ».**
  - Le champ Espèce interroge `/api/gbif/suggest` (délai de 300 ms après la frappe) et affiche une liste navigable au clavier. Au choix d'une suggestion, `/api/gbif/espece/:key` pré-remplit le nom scientifique, le nom commun, la catégorie et le groupe ; le nom commun reste vide si GBIF n'en a pas.
  - Si `/api/especes/existe` répond `existe: true`, le bandeau « Cette espèce est déjà au catalogue — les photos seront ajoutées à sa fiche » s'affiche.
  - Le sélecteur de groupe suit la catégorie choisie. Le champ Lieu est facultatif.
  - La zone de dépôt affiche les aperçus avec `URL.createObjectURL`.
  - « Enregistrer » fait d'abord `POST /api/especes`, puis un `POST …/photos` par fichier, l'un après l'autre. Une barre de progression avance au fil des envois. Chaque photo refusée est signalée avec le message du serveur, sans bloquer les autres.
  - Si GBIF échoue, son message s'affiche et les champs restent modifiables à la main.
- [ ] **Step 2 : onglet « Mon catalogue ».**
  - Liste des espèces avec recherche.
  - Un clic sur une espèce ouvre un panneau : nom commun, groupe et lieu modifiables (« Enregistrer » → `PATCH`), vignettes des photos avec un bouton « Retirer », et un bouton « Supprimer l'espèce ».
  - Chaque suppression passe par `confirm()` avec le nom concerné.
- [ ] **Step 3 : bouton « Publier » (en-tête).**
  - Il ouvre une boîte de dialogue qui liste `GET /api/publier` (changements et commits en attente), puis « Confirmer » → `POST`.
  - Il affiche « Publié — le site sera à jour dans quelques minutes » ou le message d'erreur. Il est désactivé tant que rien n'est à publier.
- [ ] **Step 4 : essai complet dans le navigateur** (`npm run dev`, puis `/admin`), avec un `origin` local pointant vers un dépôt nu temporaire :
  1. Ajouter « Copsychus saularis » avec 2 JPG. La fiche et les photos apparaissent sur `/faune/copsychus-saularis/`.
  2. Ajouter une photo à la même espèce via « Ajouter ». Le bandeau « déjà au catalogue » s'affiche et la photo est ajoutée.
  3. Déposer un `.CR3`. Il est refusé et les autres photos passent.
  4. Corriger le nom commun, puis retirer une photo.
  5. Publier.
  6. Supprimer l'espèce.

  Recommencer à 375 px de large pour l'admin.
- [ ] **Step 5 :** `npm test && npm run build`. Attendu : tout passe.
- [ ] **Step 6 :** commit `feat(admin): interface d'ajout, gestion et publication`.

### Task 10 : Mise en ligne

Ces étapes touchent le compte GitHub et Cloudflare de Léo : chaque action extérieure lui est confirmée avant d'être lancée.

- [ ] **Step 1 :** avec l'accord de Léo sur le nom du dépôt, lancer `gh repo create <nom> --public --source . --push`, ou bien Léo crée le dépôt sur github.com et on fait `git remote add origin …` puis `git push -u origin main`.
- [ ] **Step 2 :** Léo relie le dépôt dans Cloudflare Pages (Workers & Pages → Create → Pages → Connect to Git). Préréglage Astro, commande `npm run build`, dossier de sortie `dist`. Vérifier que l'adresse `*.pages.dev` affiche l'accueil.
- [ ] **Step 3 :** ajouter un `README.md` court (lancer `npm run dev`, ouvrir `http://localhost:4321/admin`, ajouter, publier), puis commit et publication.
