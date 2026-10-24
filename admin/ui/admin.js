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

async function api(chemin, opts = {}) {
  const r = await fetch(API + chemin, opts)
  const corps = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(corps.erreur || `Erreur ${r.status}`)
  return corps
}
const json = (method, corps) => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corps) })
const enc = encodeURIComponent

let GROUPES = { faune: [], flore: [] }

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
    etatGbif.textContent = d.nomCommun ? '' : 'Pas de nom français sur GBIF — saisis-le à la main.'
    if (!d.nomCommun) $('#nomCommun').focus()
  } catch (e) {
    etatGbif.textContent = e.message
  }
  verifierExistant()
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
  for (const id of ['#nomCommun', '#categorie', '#groupe', '#lieu']) $(id).disabled = !!existant
}
$('#nomScientifique').addEventListener('change', () => { gbifKey = undefined; verifierExistant() })
$('#categorie').addEventListener('change', () => remplirGroupes($('#groupe'), $('#categorie').value))

/* ---------- Ajouter : photos ---------- */
const depot = $('#depot'), champFichiers = $('#fichiers')
let photos = []

function afficherApercus() {
  $('#apercus').replaceChildren(...photos.map((p, i) =>
    el('div', { class: 'vignette' },
      el('img', { src: p.url, alt: '' }),
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
  const retour = el('p', { 'aria-live': 'polite', class: 'aide' })

  const enregistrer = async () => {
    try {
      await api(base, json('PATCH', { nomCommun: nomCommun.value, groupe: groupe.value, lieu: lieu.value }))
      retour.textContent = 'Modifications enregistrées.'
      await chargerCatalogue()
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
  $('#detail').replaceChildren(
    el('h2', {}, x.fiche.nomCommun), el('em', {}, `${x.fiche.nomScientifique} · ${x.categorie}`),
    el('div', { class: 'ligne', style: 'margin-top:1rem' },
      el('div', { class: 'champ' }, el('label', { for: 'd-nom' }, 'Nom commun'), nomCommun),
      el('div', { class: 'champ' }, el('label', { for: 'd-groupe' }, 'Groupe'), groupe)),
    el('div', { class: 'champ' }, el('label', { for: 'd-lieu' }, 'Lieu'), lieu),
    x.fiche.coordonnees ? el('p', { class: 'aide' }, `GPS : ${x.fiche.coordonnees.join(', ')}`) : null,
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
  $('#resume').replaceChildren(
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
api('/config').then((c) => { GROUPES = c.groupes; remplirGroupes($('#groupe'), $('#categorie').value) })
rafraichirPublier()
