# Portfolio naturaliste — Design

Date : 2026-10-24 · Auteur : Léo LUCAS

## Objectif

Un portfolio sobre de photo animalière et macro (loisir), qui sert aussi de
catalogue des espèces photographiées. Faune et flore au départ, minéraux
possibles plus tard. Pas de vente pour l'instant, mais rien qui l'empêche.

**Réussite** = ajouter une espèce ou des photos en quelques clics depuis une
interface locale, sans toucher aux fichiers ni à Git, et voir le site en ligne
se mettre à jour.

## Décisions

| Sujet | Choix |
|---|---|
| Générateur | Astro (site statique) |
| Hébergement | Cloudflare Pages, **nouveau** dépôt GitHub et nouveau projet |
| Contenu initial | Catalogue vide (l'ancien site Hugo n'est pas migré) |
| Fiche affichée | Nom commun + nom scientifique + photos |
| Données de nommage | GBIF (API publique), récupérées une fois et enregistrées |
| Apparence | Inspirée de l'ancien thème « naturaliste », en plus épuré : fond crème, vert forêt, EB Garamond pour les titres, fond clair |
| Plus tard (hors périmètre) | Globe interactif sur l'accueil, catégorie Minéraux, vente |

## Organisation du contenu

```
src/content/especes/
  <categorie>/            faune | flore   (mineraux plus tard)
    <slug-scientifique>/  ex. copsychus-saularis
      fiche.md
      <photos>.jpg|webp
```

`fiche.md` (frontmatter uniquement) :

```yaml
nomScientifique: Copsychus saularis   # obligatoire
nomCommun: Shama dayal                # obligatoire (GBIF ou saisi à la main)
groupe: Oiseaux                       # sous-groupe, voir ci-dessous
lieu: Bang Kachao, Thaïlande          # facultatif, non affiché (réservé au globe)
coordonnees: [13.69, 100.56]          # facultatif, lu dans le GPS de la photo
ajoute: 2026-10-24                    # date d'ajout, pour « photos récentes »
gbifKey: 2489345                      # facultatif, identifiant GBIF
```

- La **catégorie** est le nom du dossier parent.
- Le **slug** est le nom scientifique en minuscules avec des tirets. Une espèce = un dossier.
- Les **photos** sont tous les fichiers image du dossier, triés par nom.
- Le schéma est validé par Astro (content collections + zod). Une fiche invalide fait échouer la construction avec un message clair.

### Sous-groupes

Faune : Oiseaux, Insectes, Arachnides, Mammifères, Reptiles, Amphibiens,
Poissons, Autres.
Flore : Fleurs, Plantes, Champignons, Autres.

Ils sont proposés automatiquement d'après la classification GBIF (classe ou
règne : Aves → Oiseaux, Insecta → Insectes, Fungi → Champignons,
Magnoliopsida/Liliopsida → Fleurs, etc.), avec « Autres » par défaut. Ils restent
modifiables dans l'interface.

> Note : GBIF range les champignons dans le règne Fungi. On les classe tout de
> même en Flore, comme sur l'ancien site.

## Site public

- **Accueil** : titre + accroche « Carnet de terrain », sélection des photos
  les plus récentes (d'après `ajoute`), deux entrées Faune / Flore avec le
  nombre d'espèces. Un emplacement est prévu pour le futur globe (rien n'est
  construit maintenant).
- **Catégorie** (`/faune`, `/flore`) : grille de vignettes (première photo de
  chaque espèce, nom commun, nom scientifique en italique), triée par ordre
  alphabétique. Filtre par sous-groupe et recherche instantanée par nom
  (petit script côté navigateur, sans bibliothèque).
- **Fiche espèce** (`/faune/copsychus-saularis`) : noms + galerie, ouverture
  en plein écran (lightbox) avec flèches clavier et balayage sur mobile,
  Échap pour fermer.
- **À propos** : page en Markdown simple, que tu rempliras toi-même.
- **Images** : `astro:assets` génère du WebP en plusieurs tailles, avec
  chargement différé et dimensions fixées pour éviter les sauts de mise en
  page.
- **Accessibilité** : texte alternatif = nom commun + nom scientifique, la
  lightbox est utilisable au clavier, les contrastes respectent WCAG AA.

## Interface locale `/admin`

Disponible uniquement avec `npm run dev`. Les pages et routes d'API sous
`/admin` sont exclues de la version en ligne : elles ne sont générées qu'en
mode développement, et la construction échoue si l'une d'elles apparaît dans
la sortie.

### Ajouter

1. Champ **Espèce** avec autocomplétion GBIF (`/v1/species/suggest`) ; à la
   sélection, on récupère le nom vernaculaire français (`/v1/species/{key}/vernacularNames`)
   et la classification.
2. Si l'espèce existe déjà dans le catalogue, l'interface l'indique et les
   photos sont ajoutées à sa fiche.
3. **Catégorie** et **groupe** sont pré-remplis et modifiables.
4. **Lieu** : texte libre facultatif. Si la première photo contient des
   coordonnées GPS (EXIF), elles sont enregistrées automatiquement dans
   `coordonnees: [lat, lon]` (non affichées, réservées au globe). Pas de
   géocodage inversé : on évite un service externe de plus.
5. **Photos** : glisser-déposer avec aperçu.
6. **Enregistrer** : les photos sont réduites à 2500 px maximum de côté
   (via `sharp`, déjà fourni avec Astro), puis la fiche est créée ou
   complétée. Un fichier existant n'est jamais écrasé : en cas de doublon de
   nom, un suffixe est ajouté.

### Gérer

- Liste des espèces avec recherche.
- Pour chaque espèce : corriger le nom commun, le groupe ou le lieu,
  retirer une photo, supprimer l'espèce. Chaque suppression demande
  confirmation. Tes originaux restent sur ton ordinateur, et tout ce qui a
  déjà été publié reste récupérable dans l'historique Git.

### Publier

- Le bouton affiche ce qui va être envoyé (espèces et photos ajoutées,
  modifiées ou retirées), puis exécute `git add` + `git commit` + `git push`
  sur le dépôt du site.
- Les erreurs Git (pas de connexion, conflit, authentification) sont
  affichées telles quelles, avec une explication.

### Erreurs gérées

- GBIF indisponible ou aucun nom français : saisie manuelle.
- Fichier qui n'est pas une image : refusé, avec un message.
- Chemins : le slug est assaini, aucune écriture hors de `src/content/especes/`.

## Tests

- Tests unitaires (Vitest) : création du slug, choix du sous-groupe d'après
  la classification GBIF, écriture d'une fiche sans écraser l'existant,
  refus des chemins hors du dossier de contenu.
- Vérification de construction : `astro build` réussit et la sortie ne
  contient pas `/admin`.
- Essai complet dans le navigateur : ajout d'une espèce, ajout d'une photo à
  une espèce existante, correction, retrait, affichage public.

## Hors périmètre

Globe interactif, minéraux, vente, multilingue, données de prise de vue
affichées, champs détaillés (taille, poids, UICN…), commentaires, comptes.
