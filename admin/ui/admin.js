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
  { cle: 'dateObservation', label: 'Date d’observation', type: 'date' },
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
    const v = valeurs[c.cle] ?? ''
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
const onglets = { ajouter: $('#onglet-ajouter'), catalogue: $('#onglet-catalogue') }
function montrerOnglet(nom) {
  for (const [n, b] of Object.entries(onglets)) {
    b.setAttribute('aria-selected', String(n === nom))
    $(`#panneau-${n}`).hidden = n !== nom
  }
  if (nom === 'catalogue') chargerCatalogue()
}
onglets.ajouter.onclick = () => montrerOnglet('ajouter')
onglets.catalogue.onclick = () => montrerOnglet('catalogue')

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
      el('div', { class: 'nom' }, p.fichier.name))))
}
function ajouterFichiers(liste) {
  for (const f of liste) photos.push({ fichier: f, url: URL.createObjectURL(f) })
  afficherApercus()
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
let catalogue = [], selection = null

async function chargerCatalogue() {
  try {
    catalogue = await api('/especes')
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
      }, x.fiche.nomCommun, el('br'), el('em', {}, `${x.fiche.nomScientifique} · ${x.photos.length} photo${x.photos.length > 1 ? 's' : ''}`))))
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
      $('#detail [aria-live]').textContent = 'Modifications enregistrées.'
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

  $('#detail').hidden = false
  remplacer($('#detail'),
    el('h2', {}, x.fiche.nomCommun), el('em', {}, `${x.fiche.nomScientifique} · ${x.categorie}`),
    el('div', { class: 'ligne', style: 'margin-top:1rem' },
      el('div', { class: 'champ' }, el('label', { for: 'd-nom' }, 'Nom commun'), nomCommun),
      el('div', { class: 'champ' }, el('label', { for: 'd-groupe' }, 'Groupe'), groupe)),
    el('div', { class: 'ligne' },
      el('div', { class: 'champ' }, el('label', { for: 'd-lieu' }, 'Lieu'), lieu),
      el('div', { class: 'champ' },
        el('label', { for: 'd-position' }, 'Position sur le globe ', el('span', { class: 'aide' }, '(latitude, longitude)')), position)),
    x.fiche.coordonnees
      ? el('p', { class: 'aide' }, `GPS de la photo : ${x.fiche.coordonnees.join(', ')} — utilisé en priorité sur le globe.`)
      : x.fiche.lieu && !x.fiche.positionLieu
        ? el('p', { class: 'aide' }, 'Lieu introuvable sur la carte : précise-le ou saisis la position à la main.')
        : null,
    champsDetails('d', x.fiche),
    el('div', { class: 'actions' }, el('button', { type: 'button', class: 'principal', onclick: enregistrer }, 'Enregistrer')),
    retour,
    el('div', { class: 'vignettes' }, x.photos.map((nom) => el('div', { class: 'vignette' },
      el('img', { src: `${API}${base}/photos/${enc(nom)}`, alt: '', loading: 'lazy' }),
      el('button', { type: 'button', 'aria-label': `Retirer ${nom}`, onclick: () => retirer(nom) }, '×'),
      el('div', { class: 'nom' }, nom)))),
    x.photos.length ? null : el('p', { class: 'aide' }, 'Aucune photo : cette espèce n’apparaît pas sur le site.'),
    el('div', { class: 'actions' }, el('button', { type: 'button', class: 'danger', onclick: supprimer }, 'Supprimer l’espèce')),
  )
}

/* ---------- Publier ---------- */
const dialog = $('#dialog-publier'), boutonPublier = $('#publier')

async function rafraichirPublier() {
  try {
    const r = await api('/publier')
    boutonPublier.disabled = !(r.changements.length || r.commitsEnAttente)
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
