// Admin locale du Carnet de terrain — vanilla JS, aucune dépendance.
const $ = (s) => document.querySelector(s)
const API = '/admin/api'

/** Crée un élément ; les enfants texte passent par textContent (pas d'injection HTML). */
function el(tag, attrs = {}, ...enfants) {
  const e = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) {
    if (k.startsWith('on')) e.addEventListener(k.slice(2), v)
    else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v)
  }
  e.append(...enfants.flat().filter((x) => x != null && x !== false))
  return e
}

/** replaceChildren qui ignore les enfants absents (sinon « null » s'affiche en texte). */
const remplacer = (parent, ...enfants) => parent.replaceChildren(...enfants.filter((x) => x != null && x !== false))

async function api(chemin, opts = {}) {
  const r = await fetch(API + chemin, opts)
  const corps = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(corps.erreur || `Erreur ${r.status}`)
  return corps
}
const json = (method, corps) => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corps) })
const enc = encodeURIComponent

let GROUPES = { faune: [], flore: [] }

/* ---------- Infos détaillées (partagées entre Ajouter et Mon catalogue) ---------- */
const UICN = [['', '—'], ['LC', 'LC — préoccupation mineure'], ['NT', 'NT — quasi menacée'], ['VU', 'VU — vulnérable'],
  ['EN', 'EN — en danger'], ['CR', 'CR — en danger critique'], ['EW', 'EW — éteinte à l’état sauvage'], ['EX', 'EX — éteinte'],
  ['DD', 'DD — données insuffisantes'], ['NE', 'NE — non évaluée']]
const DETAILS = [
  { cle: 'dateObservation', label: 'Date d’observation', type: 'month' },
  { cle: 'taille', label: 'Taille', exemple: 'ex. 12–20 cm' },
  { cle: 'poids', label: 'Poids', exemple: 'ex. 5–10 g' },
  { cle: 'regime', label: 'Régime', exemple: 'ex. Insectivore' },
  { cle: 'floraison', label: 'Floraison', exemple: 'ex. Mai à juillet' },
  { cle: 'statutUicn', label: 'Statut UICN', type: 'uicn' },
  { cle: 'habitat', label: 'Habitat', exemple: 'ex. Forêts tropicales, jardins', large: true },
  { cle: 'description', label: 'Description / mon observation', type: 'textarea', large: true },
]

const CHAMPS_AIDE = ['taille', 'poids', 'regime', 'floraison', 'habitat']

function champsDetails(prefixe, valeurs = {}) {
  return el('div', {},
    el('div', { class: 'aide-wiki', id: `${prefixe}-aide` },
      el('button', { type: 'button', onclick: () => chargerAide(prefixe) }, 'Aide Wikipédia'),
      el('span', { class: 'aide' }, ' propose des phrases de l’article pour chaque champ — à toi de choisir et raccourcir.')),
    grilleDetails(prefixe, valeurs))
}

/** Phrases Wikipédia sous chaque champ ; un clic copie la phrase dans le champ, à raccourcir ensuite. */
async function chargerAide(prefixe) {
  const sci = (prefixe === 'a' ? $('#nomScientifique').value : selection?.fiche.nomScientifique)?.trim()
  const commun = (prefixe === 'a' ? $('#nomCommun') : $('#d-nom'))?.value.trim()
  const zone = $(`#${prefixe}-aide`)
  if (!sci) return remplacer(zone, el('span', { class: 'aide' }, 'Choisis d’abord l’espèce.'))
  remplacer(zone, el('span', { class: 'aide' }, 'Recherche sur Wikipédia…'))
  for (const cle of CHAMPS_AIDE) $(`#${prefixe}-${cle}-sugg`).replaceChildren()
  let a
  try {
    a = await api(`/aide?sci=${enc(sci)}&commun=${enc(commun ?? '')}`)
  } catch (e) {
    return remplacer(zone, el('span', { class: 'aide' }, e.message))
  }
  const trouvees = CHAMPS_AIDE.reduce((n, cle) => n + a.extraits[cle].length, 0)
  remplacer(zone,
    a.url ? el('a', { href: a.url, target: '_blank', rel: 'noopener' }, `Wikipédia : ${a.titre}`) : el('span', { class: 'aide' }, 'Pas d’article Wikipédia en français.'),
    a.inaturalist ? el('a', { href: a.inaturalist, target: '_blank', rel: 'noopener' }, 'iNaturalist') : null,
    a.url ? el('span', { class: 'aide' }, trouvees ? `${trouvees} phrase(s) proposée(s) sous les champs.` : 'Aucune phrase utile trouvée.') : null,
    // GBIF propose parfois un nom vieilli (« Goupil ») : le titre Wikipédia est souvent le nom usuel.
    a.titre && a.titre !== sci && a.titre !== commun
      ? el('button', { type: 'button', class: 'suggestion', onclick: (e) => {
          ;(prefixe === 'a' ? $('#nomCommun') : $('#d-nom')).value = a.titre
          e.currentTarget.remove()
        } }, `Nom commun : « ${a.titre} » ?`)
      : null,
  )
  for (const cle of CHAMPS_AIDE) {
    $(`#${prefixe}-${cle}-sugg`).replaceChildren(...a.extraits[cle].map((p) =>
      el('button', { type: 'button', class: 'suggestion', title: 'Copier dans le champ', onclick: () => {
        const champ = $(`#${prefixe}-${cle}`)
        champ.value = p
        champ.focus()
      } }, p)))
  }
}

function grilleDetails(prefixe, valeurs) {
  return el('div', { class: 'grille-details' }, DETAILS.map((c) => {
    const id = `${prefixe}-${c.cle}`
    // Champ mois : une ancienne date au jour (AAAA-MM-JJ) s'affiche au mois.
    const v = c.type === 'month' ? (valeurs[c.cle] ?? '').slice(0, 7) : valeurs[c.cle] ?? ''
    const saisie = c.type === 'uicn'
      ? el('select', { id }, UICN.map(([code, texte]) => el('option', { value: code, selected: code === v }, texte)))
      : c.type === 'textarea'
        ? Object.assign(el('textarea', { id, placeholder: 'Ce que tu as observé, le comportement, le contexte de la photo…' }), { value: v })
        : el('input', { id, type: c.type ?? 'text', value: v, placeholder: c.exemple })
    return el('div', { class: `champ${c.large ? ' large' : ''}` }, el('label', { for: id }, c.label), saisie,
      CHAMPS_AIDE.includes(c.cle) ? el('div', { class: 'suggestions', id: `${id}-sugg` }) : null)
  }))
}
const lireDetails = (prefixe) => Object.fromEntries(DETAILS.map((c) => [c.cle, $(`#${prefixe}-${c.cle}`).value]))

function remplirGroupes(select, categorie, choisi) {
  select.replaceChildren(...GROUPES[categorie].map((g) => el('option', { value: g, selected: g === choisi }, g)))
}

/* ---------- Onglets ---------- */
const onglets = { ajouter: $('#onglet-ajouter'), catalogue: $('#onglet-catalogue'), coeurs: $('#onglet-coeurs') }
function montrerOnglet(nom) {
  for (const [n, b] of Object.entries(onglets)) {
    b.setAttribute('aria-selected', String(n === nom))
    $(`#panneau-${n}`).hidden = n !== nom
  }
  if (nom === 'catalogue') chargerCatalogue()
  if (nom === 'coeurs') chargerCoeurs()
}
for (const nom of Object.keys(onglets)) onglets[nom].onclick = () => montrerOnglet(nom)

/* ---------- Dates : stockées au mois (AAAA-MM), affichées « mai 2026 » ---------- */
const moisAnnee = (v) => (v ? new Date(`${v.slice(0, 7)}-01T00:00:00Z`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' }) : '')

/** Mois de prise de vue lu dans l'EXIF du fichier (exifr, chargé par index.html), ou '' . */
async function moisDePriseDeVue(fichier) {
  try {
    // La version « lite » d'exifr n'accepte pas de liste de champs : on lit l'EXIF entier.
    const d = (await window.exifr?.parse(fichier))?.DateTimeOriginal
    return d instanceof Date && !isNaN(d) ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` : ''
  } catch { return '' }
}

/** Glisser-déposer pour réordonner les enfants [data-index] d'un conteneur ; `deplacer(de, vers)` fait le reste. */
function activerGlisser(conteneur, deplacer) {
  let depart = null
  conteneur.addEventListener('dragstart', (e) => {
    const t = e.target.closest('[data-index]')
    if (!t) return
    depart = Number(t.dataset.index)
    e.dataTransfer.effectAllowed = 'move'
    t.classList.add('glisse')
  })
  conteneur.addEventListener('dragend', (e) => e.target.closest('[data-index]')?.classList.remove('glisse'))
  conteneur.addEventListener('dragover', (e) => {
    if (depart === null) return
    e.preventDefault()
    for (const t of conteneur.querySelectorAll('.cible')) t.classList.remove('cible')
    e.target.closest('[data-index]')?.classList.add('cible')
  })
  conteneur.addEventListener('drop', (e) => {
    e.preventDefault()
    const t = e.target.closest('[data-index]')
    for (const c of conteneur.querySelectorAll('.cible')) c.classList.remove('cible')
    if (t && depart !== null && Number(t.dataset.index) !== depart) deplacer(depart, Number(t.dataset.index))
    depart = null
  })
}
const deplacerDans = (liste, de, vers) => { const copie = [...liste]; copie.splice(vers, 0, copie.splice(de, 1)[0]); return copie }

/* ---------- Ajouter : recherche GBIF ---------- */
const recherche = $('#recherche'), liste = $('#suggestions'), etatGbif = $('#etat-gbif')
let suggestions = [], actif = -1, minuterie, gbifKey

function fermerSuggestions() {
  liste.hidden = true
  recherche.setAttribute('aria-expanded', 'false')
  actif = -1
}

function afficherSuggestions() {
  liste.replaceChildren(...suggestions.map((s, i) =>
    el('li', { role: 'option', id: `sugg-${i}`, 'aria-selected': String(i === actif), onmousedown: (e) => { e.preventDefault(); choisir(i) } },
      el('span', {}, s.nomScientifique), el('span', { class: 'rang' }, s.rang.toLowerCase()))))
  liste.hidden = suggestions.length === 0
  recherche.setAttribute('aria-expanded', String(!liste.hidden))
  if (actif >= 0) recherche.setAttribute('aria-activedescendant', `sugg-${actif}`)
  else recherche.removeAttribute('aria-activedescendant')
}

recherche.addEventListener('input', () => {
  clearTimeout(minuterie)
  minuterie = setTimeout(async () => {
    const q = recherche.value.trim()
    if (q.length < 2) { suggestions = []; return fermerSuggestions() }
    try {
      suggestions = await api(`/gbif/suggest?q=${enc(q)}`)
      etatGbif.textContent = suggestions.length ? '' : 'Aucun résultat sur GBIF — tu peux remplir les champs à la main.'
      actif = -1
      afficherSuggestions()
    } catch (e) {
      etatGbif.textContent = e.message
      fermerSuggestions()
    }
  }, 300)
})

recherche.addEventListener('keydown', (e) => {
  // Entrée ici sert à choisir une suggestion, jamais à soumettre le formulaire.
  if (e.key === 'Enter') e.preventDefault()
  if (liste.hidden) return
  if (e.key === 'ArrowDown') { actif = Math.min(actif + 1, suggestions.length - 1); afficherSuggestions(); e.preventDefault() }
  else if (e.key === 'ArrowUp') { actif = Math.max(actif - 1, 0); afficherSuggestions(); e.preventDefault() }
  else if (e.key === 'Enter' && actif >= 0) { choisir(actif); e.preventDefault() }
  else if (e.key === 'Escape') fermerSuggestions()
})
recherche.addEventListener('blur', () => setTimeout(fermerSuggestions, 100))

async function choisir(i) {
  const s = suggestions[i]
  fermerSuggestions()
  recherche.value = s.nomScientifique
  $('#nomScientifique').value = s.nomScientifique
  etatGbif.textContent = 'Recherche du nom français…'
  try {
    const d = await api(`/gbif/espece/${s.key}`)
    gbifKey = d.gbifKey
    $('#nomScientifique').value = d.nomScientifique
    $('#nomCommun').value = d.nomCommun ?? ''
    if (d.categorie) $('#categorie').value = d.categorie
    remplirGroupes($('#groupe'), $('#categorie').value, d.groupe)
    $('#a-statutUicn').value = d.statutUicn ?? ''
    etatGbif.textContent = d.nomCommun ? '' : 'Pas de nom français sur GBIF — saisis-le à la main.'
    if (!d.nomCommun) $('#nomCommun').focus()
  } catch (e) {
    etatGbif.textContent = e.message
  }
  verifierExistant()
  // Espèce choisie : on prépare les phrases Wikipédia sans attendre un clic.
  chargerAide('a')
}

/* ---------- Ajouter : espèce déjà présente ? ---------- */
let existant = null
async function verifierExistant() {
  const nom = $('#nomScientifique').value.trim()
  existant = null
  if (nom) {
    try {
      const r = await api(`/especes/existe?nom=${enc(nom)}`)
      if (r.existe) existant = r
    } catch { /* nom invalide : signalé à l'enregistrement */ }
  }
  $('#deja').hidden = !existant
  // Espèce existante : ces champs se modifient dans « Mon catalogue », pas ici.
  for (const e of document.querySelectorAll('#nomCommun, #categorie, #groupe, #lieu, #infos-ajout input, #infos-ajout select, #infos-ajout textarea')) {
    e.disabled = !!existant
  }
}
$('#nomScientifique').addEventListener('change', () => { gbifKey = undefined; verifierExistant() })
$('#categorie').addEventListener('change', () => remplirGroupes($('#groupe'), $('#categorie').value))

/* ---------- Ajouter : photos ---------- */
const depot = $('#depot'), champFichiers = $('#fichiers')
let photos = []

function afficherApercus() {
  $('#apercus').replaceChildren(...photos.map((p, i) =>
    el('div', { class: 'vignette' },
      ['image/jpeg', 'image/png', 'image/webp'].includes(p.fichier.type)
        ? el('img', { src: p.url, alt: '' })
        : el('div', { class: 'sans-apercu' }, 'Format non pris en charge'),
      el('button', { type: 'button', 'aria-label': `Retirer ${p.fichier.name}`, onclick: () => { URL.revokeObjectURL(p.url); photos.splice(i, 1); afficherApercus() } }, '×'),
      el('div', { class: 'nom' }, p.fichier.name),
      p.mois ? el('div', { class: 'nom' }, `Prise en ${moisAnnee(p.mois)}`) : null)))
}
async function ajouterFichiers(liste) {
  const nouvelles = [...liste].map((f) => ({ fichier: f, url: URL.createObjectURL(f), mois: '' }))
  photos.push(...nouvelles)
  afficherApercus()
  // Date de prise de vue lue tout de suite : elle pré-remplit la date d'observation si elle est vide.
  for (const p of nouvelles) p.mois = await moisDePriseDeVue(p.fichier)
  afficherApercus()
  const champ = $('#a-dateObservation'), premiere = photos.find((p) => p.mois)?.mois
  if (premiere && !champ.value && !champ.disabled) {
    champ.value = premiere
    $('#date-lue').textContent = `Date d’observation pré-remplie : ${moisAnnee(premiere)} (lue dans la photo, modifiable dans « Infos détaillées »).`
  }
}
champFichiers.addEventListener('change', () => { ajouterFichiers(champFichiers.files); champFichiers.value = '' })
depot.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); champFichiers.click() } })
depot.addEventListener('dragover', (e) => { e.preventDefault(); depot.classList.add('survol') })
depot.addEventListener('dragleave', () => depot.classList.remove('survol'))
depot.addEventListener('drop', (e) => { e.preventDefault(); depot.classList.remove('survol'); ajouterFichiers(e.dataTransfer.files) })

/* ---------- Ajouter : enregistrer ---------- */
const messages = $('#messages')
const message = (texte, type) => messages.append(el('li', { class: type }, texte))

$('#form-ajout').addEventListener('submit', async (e) => {
  e.preventDefault()
  messages.replaceChildren()
  if (!photos.length) return message('Ajoute au moins une photo.', 'erreur')
  const bouton = $('#enregistrer'), barre = $('#progression')
  bouton.disabled = true

  try {
    const { espece, existait } = await api('/especes', json('POST', {
      ...lireDetails('a'),
      categorie: $('#categorie').value,
      nomScientifique: $('#nomScientifique').value,
      // Espèce existante : le serveur renvoie la fiche telle quelle, ce nom n'est pas utilisé.
      nomCommun: existant ? '-' : $('#nomCommun').value,
      groupe: $('#groupe').value,
      lieu: $('#lieu').value,
      gbifKey,
    }))
    message(existait ? `Ajout à la fiche existante « ${espece.fiche.nomCommun} ».` : `Fiche « ${espece.fiche.nomCommun} » créée.`, 'ok')

    barre.hidden = false
    barre.max = photos.length
    barre.value = 0
    const restantes = []
    // Une photo à la fois : une erreur sur l'une n'empêche pas les autres.
    for (const p of photos) {
      try {
        await api(`/especes/${espece.categorie}/${espece.slug}/photos?nom=${enc(p.fichier.name)}`, {
          method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: p.fichier,
        })
        message(`✓ ${p.fichier.name}`, 'ok')
        URL.revokeObjectURL(p.url)
      } catch (err) {
        message(`✗ ${p.fichier.name} : ${err.message}`, 'erreur')
        restantes.push(p)
      }
      barre.value++
    }
    photos = restantes
    afficherApercus()
    if (!restantes.length) {
      for (const id of ['#recherche', '#nomScientifique', '#nomCommun', '#lieu']) $(id).value = ''
      $('#infos-ajout').replaceChildren(champsDetails('a'))
      $('#date-lue').textContent = ''
      gbifKey = undefined
      verifierExistant()
      message(`Visible sur le site local : /${espece.categorie}/${espece.slug}/`, 'ok')
    }
  } catch (err) {
    message(err.message, 'erreur')
  } finally {
    bouton.disabled = false
    barre.hidden = true
    rafraichirPublier()
  }
})

/* ---------- Catalogue ---------- */
let catalogue = [], selection = null, coeurs = new Set()
const urlPhoto = (cat, slug, nom) => `${API}/especes/${cat}/${slug}/photos/${enc(nom)}`

async function chargerCatalogue() {
  try {
    const [liste, listeCoeurs] = await Promise.all([api('/especes'), api('/coups-de-coeur')])
    catalogue = liste
    coeurs = new Set(listeCoeurs.map((c) => c.id))
  } catch (e) {
    catalogue = []
    $('#liste').replaceChildren(el('li', { class: 'vide' }, e.message))
    return
  }
  afficherListe()
  const encore = selection && catalogue.find((x) => x.categorie === selection.categorie && x.slug === selection.slug)
  if (encore) afficherDetail(encore)
  else { selection = null; $('#detail').hidden = true }
}

function afficherListe() {
  const q = $('#filtre-catalogue').value.trim().toLowerCase()
  const vus = catalogue.filter((x) => `${x.fiche.nomCommun} ${x.fiche.nomScientifique}`.toLowerCase().includes(q))
  $('#liste').replaceChildren(...(vus.length
    ? vus.map((x) => el('li', {}, el('button', {
        type: 'button', 'aria-current': String(selection?.slug === x.slug && selection?.categorie === x.categorie),
        onclick: () => afficherDetail(x),
      },
        x.photos[0] ? el('img', { src: urlPhoto(x.categorie, x.slug, x.photos[0]), alt: '', loading: 'lazy' }) : el('span', { class: 'sans-miniature' }),
        el('span', {}, x.fiche.nomCommun, el('br'), el('em', {}, `${x.fiche.nomScientifique} · ${x.photos.length} photo${x.photos.length > 1 ? 's' : ''}`)))))
    : [el('li', { class: 'vide' }, catalogue.length ? 'Aucune espèce trouvée.' : 'Catalogue vide — commence par « Ajouter ».')]))
}
$('#filtre-catalogue').addEventListener('input', afficherListe)

function afficherDetail(x) {
  selection = x
  afficherListe()
  const base = `/especes/${x.categorie}/${x.slug}`
  const nomCommun = el('input', { value: x.fiche.nomCommun, id: 'd-nom' })
  const groupe = el('select', { id: 'd-groupe' })
  remplirGroupes(groupe, x.categorie, x.fiche.groupe)
  const lieu = el('input', { value: x.fiche.lieu ?? '', id: 'd-lieu' })
  const position = el('input', { value: x.fiche.positionLieu?.join(', ') ?? '', id: 'd-position', placeholder: 'calculée depuis le lieu' })
  const retour = el('p', { 'aria-live': 'polite', class: 'aide' })

  const enregistrer = async () => {
    try {
      await api(base, json('PATCH', {
        ...lireDetails('d'), nomCommun: nomCommun.value, groupe: groupe.value, lieu: lieu.value, positionLieu: position.value,
      }))
      await chargerCatalogue()
      // Le panneau vient d'être redessiné : on écrit dans le nouveau.
      $('#detail-retour').textContent = 'Modifications enregistrées.'
      rafraichirPublier()
    } catch (e) { retour.textContent = e.message }
  }
  const retirer = async (nom) => {
    if (!confirm(`Retirer la photo « ${nom} » de ${x.fiche.nomCommun} ?`)) return
    try { await api(`${base}/photos/${enc(nom)}`, { method: 'DELETE' }); await chargerCatalogue(); rafraichirPublier() }
    catch (e) { retour.textContent = e.message }
  }
  const supprimer = async () => {
    if (!confirm(`Supprimer l'espèce « ${x.fiche.nomCommun} » et ses ${x.photos.length} photo(s) ?`)) return
    try { await api(base, { method: 'DELETE' }); selection = null; await chargerCatalogue(); rafraichirPublier() }
    catch (e) { retour.textContent = e.message }
  }
  // Nouvel ordre des photos : la première devient la principale.
  const deplacer = async (de, vers) => {
    if (vers < 0 || vers >= x.photos.length) return
    try {
      await api(`${base}/ordre`, json('PUT', { ordre: deplacerDans(x.photos, de, vers) }))
      await chargerCatalogue()
      $('#photos-retour').textContent = de === 0 || vers === 0 ? 'Nouvelle photo principale.' : 'Ordre enregistré.'
      rafraichirPublier()
    } catch (e) { $('#photos-retour').textContent = e.message }
  }

  const grille = el('div', { class: 'tuiles-photos' }, x.photos.map((nom, i) => tuilePhoto(base, x, nom, i, retirer, deplacer)))
  activerGlisser(grille, deplacer)

  $('#detail').hidden = false
  remplacer($('#detail'),
    el('div', { class: 'detail-infos' },
      el('h2', {}, x.fiche.nomCommun), el('em', {}, `${x.fiche.nomScientifique} · ${x.categorie}`),
      el('div', { class: 'ligne', style: 'margin-top:1rem' },
        el('div', { class: 'champ' }, el('label', { for: 'd-nom' }, 'Nom commun'), nomCommun),
        el('div', { class: 'champ' }, el('label', { for: 'd-groupe' }, 'Groupe'), groupe)),
      el('div', { class: 'ligne' },
        el('div', { class: 'champ' }, el('label', { for: 'd-lieu' }, 'Lieu'), lieu),
        el('div', { class: 'champ' },
          el('label', { for: 'd-position' }, 'Position ', el('span', { class: 'aide' }, '(latitude, longitude)')), position)),
      champsDetails('d', x.fiche),
      el('div', { class: 'actions' },
        el('button', { type: 'button', class: 'danger', onclick: supprimer }, 'Supprimer l’espèce'),
        el('button', { type: 'button', class: 'principal', onclick: enregistrer }, 'Enregistrer la fiche')),
      el('p', { id: 'detail-retour', 'aria-live': 'polite', class: 'aide' }),
      retour),
    el('div', { class: 'detail-photos' },
      el('h3', { class: 'titre-photos' }, `Photos (${x.photos.length}) `,
        el('span', { class: 'aide' }, x.photos.length > 1 ? '— glisse pour réordonner, la première est la principale' : '')),
      el('p', { id: 'photos-retour', class: 'aide', 'aria-live': 'polite' }),
      x.photos.length ? grille : el('p', { class: 'aide' }, 'Aucune photo : cette espèce n’apparaît pas sur le site.')),
  )
}

/** Tuile d'une photo : aperçu, ordre, coup de cœur, légende / date / lieu propres à la photo. */
function tuilePhoto(base, x, nom, i, retirer, deplacer) {
  const infos = x.fiche.photos?.[nom] ?? {}
  const id = (c) => `p${i}-${c}`
  const retour = el('span', { class: 'aide', 'aria-live': 'polite' })
  const enregistrer = async () => {
    try {
      await api(`${base}/photos/${enc(nom)}`, json('PATCH', {
        legende: $(`#${id('legende')}`).value, date: $(`#${id('date')}`).value, lieu: $(`#${id('lieu')}`).value,
      }))
      retour.textContent = 'Enregistré.'
      rafraichirPublier()
    } catch (e) { retour.textContent = e.message }
  }
  // Coup de cœur : enregistré dès le clic, ajouté à la fin de la mosaïque (ordre réglable dans l'onglet Coups de cœur).
  const coeur = el('input', { type: 'checkbox', id: id('coeur'), checked: coeurs.has(`${x.categorie}/${x.slug}/${nom}`), onchange: async (e) => {
    const coche = e.currentTarget.checked
    try {
      await api(`${base}/photos/${enc(nom)}`, json('PATCH', { coupDeCoeur: coche }))
      coche ? coeurs.add(`${x.categorie}/${x.slug}/${nom}`) : coeurs.delete(`${x.categorie}/${x.slug}/${nom}`)
      retour.textContent = coche ? 'Ajoutée aux coups de cœur.' : 'Retirée des coups de cœur.'
      rafraichirPublier()
    } catch (err) { e.currentTarget.checked = !coche; retour.textContent = err.message }
  } })
  return el('div', { class: 'tuile-photo', draggable: 'true', 'data-index': i },
    el('div', { class: 'tuile-image' },
      el('img', { src: urlPhoto(x.categorie, x.slug, nom), alt: '', loading: 'lazy', draggable: 'false' }),
      i === 0 ? el('span', { class: 'badge-principale' }, 'Principale') : null,
      el('div', { class: 'tuile-ordre' },
        el('button', { type: 'button', 'aria-label': `Avancer ${nom}`, disabled: i === 0, onclick: () => deplacer(i, i - 1) }, '◀'),
        el('button', { type: 'button', 'aria-label': `Reculer ${nom}`, disabled: i === x.photos.length - 1, onclick: () => deplacer(i, i + 1) }, '▶'))),
    el('label', { class: 'coeur', for: id('coeur') }, coeur, el('i', { class: 'etoile', 'aria-hidden': 'true' }, '★'), ' Coup de cœur'),
    el('div', { class: 'champ' }, el('label', { for: id('legende') }, 'Légende'),
      el('input', { id: id('legende'), value: infos.legende ?? '', placeholder: 'ex. Mâle, Juvénile' })),
    el('div', { class: 'ligne' },
      el('div', { class: 'champ' }, el('label', { for: id('date') }, 'Date'),
        el('input', { id: id('date'), type: 'month', value: (infos.date ?? '').slice(0, 7) })),
      el('div', { class: 'champ' }, el('label', { for: id('lieu') }, 'Lieu'),
        el('input', { id: id('lieu'), value: infos.lieu ?? '', placeholder: x.fiche.lieu ?? '' }))),
    el('div', { class: 'actions' },
      el('button', { type: 'button', class: 'danger', onclick: () => retirer(nom) }, 'Retirer'),
      el('button', { type: 'button', class: 'principal', onclick: enregistrer }, 'Enregistrer')),
    retour)
}

/* ---------- Coups de cœur : la mosaïque de l'accueil, à réordonner ---------- */
let listeCoeurs = []

async function chargerCoeurs() {
  try { listeCoeurs = await api('/coups-de-coeur') }
  catch (e) { $('#coeurs-retour').textContent = e.message; return }
  afficherCoeurs()
}

function afficherCoeurs() {
  const zone = $('#mosaique-admin')
  if (!listeCoeurs.length) return remplacer(zone, el('p', { class: 'aide' }, 'Aucun coup de cœur : coche ★ des photos dans « Mon catalogue ».'))
  zone.replaceChildren(...listeCoeurs.map((c, i) => el('figure', { class: i === 0 ? 'grande' : null, draggable: 'true', 'data-index': i },
    el('img', { src: urlPhoto(c.categorie, c.slug, c.nom), alt: '', loading: 'lazy', draggable: 'false' }),
    el('figcaption', {}, c.nomCommun, c.legende ? el('em', {}, ` · ${c.legende}`) : null),
    el('div', { class: 'tuile-ordre' },
      el('button', { type: 'button', 'aria-label': `Avancer ${c.nomCommun}`, disabled: i === 0, onclick: () => deplacerCoeur(i, i - 1) }, '◀'),
      el('button', { type: 'button', 'aria-label': `Reculer ${c.nomCommun}`, disabled: i === listeCoeurs.length - 1, onclick: () => deplacerCoeur(i, i + 1) }, '▶'),
      el('button', { type: 'button', 'aria-label': `Retirer ${c.nomCommun} des coups de cœur`, title: 'Retirer des coups de cœur', onclick: () => retirerCoeur(c) }, '✕')))))
}

async function deplacerCoeur(de, vers) {
  if (vers < 0 || vers >= listeCoeurs.length) return
  try {
    listeCoeurs = await api('/coups-de-coeur', json('PUT', { ordre: deplacerDans(listeCoeurs.map((c) => c.id), de, vers) }))
    afficherCoeurs()
    $('#coeurs-retour').textContent = vers === 0 ? 'Nouvelle photo en grand sur l’accueil.' : 'Ordre enregistré.'
    rafraichirPublier()
  } catch (e) { $('#coeurs-retour').textContent = e.message }
}

async function retirerCoeur(c) {
  try {
    await api(`/especes/${c.categorie}/${c.slug}/photos/${enc(c.nom)}`, json('PATCH', { coupDeCoeur: false }))
    await chargerCoeurs()
    $('#coeurs-retour').textContent = `${c.nomCommun} retiré des coups de cœur.`
    rafraichirPublier()
  } catch (e) { $('#coeurs-retour').textContent = e.message }
}
activerGlisser($('#mosaique-admin'), deplacerCoeur)

/* ---------- Publier ---------- */
const dialog = $('#dialog-publier'), boutonPublier = $('#publier')

async function rafraichirPublier() {
  try {
    const r = await api('/publier')
    // Compte les espèces touchées (faune/slug/...) plutôt que les fichiers ; la liste des coups de cœur compte pour un.
    const touches = new Set(r.changements.map((c) => c.chemin.split('/').slice(0, 2).join('/'))).size
    boutonPublier.disabled = !(touches || r.commitsEnAttente)
    boutonPublier.textContent = touches ? `Publier (${touches})` : 'Publier'
    return r
  } catch (e) {
    boutonPublier.disabled = true
    boutonPublier.title = e.message
  }
}

boutonPublier.addEventListener('click', async () => {
  const r = await rafraichirPublier()
  if (!r) return
  $('#resultat-publier').textContent = ''
  $('#confirmer-publier').disabled = false
  remplacer($('#resume'),
    r.changements.length
      ? el('ul', {}, r.changements.map((c) => el('li', {}, el('span', {}, c.etat), c.chemin)))
      : el('p', {}, 'Aucun nouveau changement.'),
    r.commitsEnAttente ? el('p', { class: 'aide' }, `${r.commitsEnAttente} envoi(s) précédent(s) en attente.`) : null,
  )
  dialog.showModal()
})
$('#annuler-publier').addEventListener('click', () => dialog.close())
$('#confirmer-publier').addEventListener('click', async () => {
  const b = $('#confirmer-publier'), sortie = $('#resultat-publier')
  b.disabled = true
  sortie.textContent = 'Publication en cours…'
  try {
    await api('/publier', { method: 'POST' })
    sortie.textContent = 'Publié — le site sera à jour dans quelques minutes.'
  } catch (e) {
    sortie.textContent = e.message
    b.disabled = false
  }
  rafraichirPublier()
})

/* ---------- Démarrage ---------- */
$('#infos-ajout').replaceChildren(champsDetails('a'))
api('/config').then((c) => { GROUPES = c.groupes; remplirGroupes($('#groupe'), $('#categorie').value) })
rafraichirPublier()
