// ─────────────────────────────────────────────────────────────────────────────
// parseTranscription — heuristique pure, sans side effects, sans IA payante
// Retourne { lead: {...}, etablissement: string|null }
// ─────────────────────────────────────────────────────────────────────────────

// ── Dictionnaires ─────────────────────────────────────────────────────────────

const ETABLISSEMENTS = [
  { label: 'camping',          mots: ['camping', 'campsite', 'bungalow', 'mobil-home', 'emplacement', 'aire naturelle'] },
  { label: 'hôtel',            mots: ['hôtel', 'hotel', 'lodge', 'auberge de jeunesse'] },
  { label: 'restaurant',       mots: ['restaurant', 'brasserie', 'bistro', 'bistrot', 'auberge', 'traiteur', 'taverne'] },
  { label: 'château',          mots: ['château', 'manoir', 'bastide', 'gentilhommière'] },
  { label: 'gîte',             mots: ['gîte', 'gite', 'chambres d\'hôtes', 'chambre d\'hote', 'chambre hote'] },
  { label: 'domaine viticole', mots: ['domaine', 'vignoble', 'cave', 'cave coopérative', 'château viticole'] },
  { label: 'site touristique', mots: ['abbaye', 'prieuré', 'cathédrale', 'église', 'grotte', 'gouffre', 'zoo', 'parc naturel', 'réserve', 'musée', 'monument'] },
  { label: 'camping',          mots: ['terrain de camping'] },
  { label: 'mairie',           mots: ['mairie', 'commune', 'collectivité', 'communauté de communes', 'syndicat'] },
  { label: 'entreprise',       mots: ['entreprise', 'société', 'sarl', 'sas', 'sasu', 'eurl', 'holding', 'groupe', 'cabinet', 'agence', 'bureau d\'études'] },
  { label: 'commerce',         mots: ['boutique', 'magasin', 'commerce', 'épicerie', 'librairie', 'boulangerie', 'pharmacie'] },
  { label: 'artisan',          mots: ['artisan', 'artisanat', 'menuisier', 'maçon', 'plombier', 'électricien'] },
  { label: 'immobilier',       mots: ['immobilier', 'promoteur', 'lotissement', 'agence immobilière', 'notaire'] },
  { label: 'santé',            mots: ['clinique', 'cabinet médical', 'cabinet dentaire', 'médecin', 'kiné', 'ostéo'] },
]

const MOTS_PROFESSIONNEL = [
  'camping', 'campsite', 'hôtel', 'hotel', 'lodge', 'restaurant', 'brasserie', 'bistro', 'bistrot',
  'auberge', 'château', 'manoir', 'domaine', 'gîte', 'gite', 'mairie', 'commune', 'association',
  'entreprise', 'société', 'sarl', 'sas', 'sasu', 'eurl', 'artisan', 'boutique', 'agence',
  'cabinet', 'clinique', 'musée', 'vignoble', 'cave', 'abbaye', 'prieuré', 'cathédrale',
  'grotte', 'zoo', 'parc', 'office de tourisme', 'maison de retraite', 'ehpad', 'syndicat',
  'communauté', 'collectivité', 'promoteur', 'immobilier', 'commerce', 'magasin',
]

const MOTS_PARTICULIER = [
  'particulier', 'famille', 'mariage', 'fiançailles', 'anniversaire', 'baptême', 'bapteme',
  'communion', 'retraite', 'privé', 'prive', 'maison privée', 'mariage privé', 'fête de famille',
  'entre amis', 'usage personnel', 'pour moi', 'propriétaire',
]

const VILLES_PERIGORD = [
  'Périgueux', 'Sarlat', 'Sarlat-la-Canéda', 'Bergerac', 'Brive', 'Brive-la-Gaillarde',
  'Domme', 'Beynac', 'Rocamadour', 'Les Eyzies', 'Montignac', 'Belvès', 'Monpazier',
  'Lalinde', 'Terrasson', 'Saint-Cyprien', 'Cadouin', 'Mussidan', 'Villefranche-du-Périgord',
  'Thénon', 'Ribérac', 'Nontron', 'Excideuil', 'Hautefort', 'Rouffignac', 'Le Bugue',
  'Trémolat', 'Limeuil', 'Castelnaud', 'La Roque-Gageac', 'Montfort', 'Vézac',
  'Sainte-Alvère', 'Issigeac', 'Eymet', 'Sigoulès', 'Villeréal', 'Beaumont-du-Périgord',
  'Cahors', 'Gourdon', 'Figeac', 'Souillac',
]

const TYPES_BESOIN = [
  { label: 'drone', mots: ['drone', 'aérien', 'aerien', 'survol', 'prise de vue aérienne', 'prise de vue aerienne', 'vue du ciel', 'fpv'] },
  { label: 'vidéo', mots: ['vidéo', 'video', 'film', 'tournage', 'reportage', 'clip', 'rushe', 'rushs', 'montage', 'documentaire', 'interview'] },
  { label: 'photo', mots: ['photo', 'photographie', 'shooting', 'cliché', 'cliche', 'portraits', 'prise de vue'] },
  { label: 'corporate', mots: ['corporate', 'institutionnel', 'présentation entreprise', 'communication interne', 'teaser'] },
  { label: 'événementiel', mots: ['événement', 'evenement', 'event', 'soirée', 'soiree', 'cérémonie', 'ceremonie', 'gala', 'concert', 'spectacle'] },
]

const MOTS_PRIORITE_HAUTE = [
  'urgent', 'urgence', 'dès que possible', 'des que possible', 'asap', 'rapidement', 'très vite',
  'cette semaine', 'ce mois', 'prioritaire', 'impératif', 'imperatif', 'absolument', 'vite',
]
const MOTS_PRIORITE_BASSE = [
  'pas urgent', 'plus tard', 'éventuellement', 'eventuellement', 'à terme', 'a terme',
  'dans quelques mois', 'dans plusieurs mois', 'dans un an', 'à l\'avenir', 'plus tard dans l\'année',
  'prochaine saison',
]

const MOTS_INTERET_FORT = [
  'très intéressé', 'tres interesse', 'super intéressé', 'enthousiaste', 'ravi', 'enchanté',
  'on fonce', 'partant', 'validé', 'valide', 'accord de principe', 'il veut', 'elle veut',
  'vraiment motivé', 'vraiment interesse', 'ça l\'intéresse', 'ca l\'interesse',
  'fonctionne', 'banco', 'deal', 'ok pour', 'accord', 'super motivé',
]
const MOTS_INTERET_FAIBLE = [
  'pas sûr', 'pas sur', 'hésite', 'hesite', 'réfléchit', 'reflechit', 'peut-être', 'peut etre',
  'on verra', 'doute', 'peu convaincu', 'pas convaincu', 'mitigé', 'mitige', 'réticent',
  'pas très chaud', 'pas trop', 'à voir',
]

// ── Helpers ────────────────────────────────────────────────────────────────────

function normalize(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function contains(text, mots) {
  const n = normalize(text)
  return mots.some(m => n.includes(normalize(m)))
}

function firstMatch(text, mots) {
  const n = normalize(text)
  return mots.find(m => n.includes(normalize(m))) || null
}

// ── Détection email ────────────────────────────────────────────────────────────

function detectEmail(text) {
  const m = text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/i)
  return m ? m[0] : ''
}

// ── Détection téléphone ────────────────────────────────────────────────────────

function detectTelephone(text) {
  const m = text.match(
    /(?:(?:\+|00)33[\s.\-]?)?0?[1-9](?:[\s.\-]?\d{2}){4}/
  )
  if (!m) return ''
  // Normalise format
  return m[0].replace(/[\s.\-]/g, '').replace(/^0033/, '+33').replace(/^33/, '+33')
}

// ── Détection ville ────────────────────────────────────────────────────────────

function detectVille(text) {
  // 1. Chercher dans le dictionnaire Périgord (exact, insensible casse)
  for (const v of VILLES_PERIGORD) {
    if (normalize(text).includes(normalize(v))) return v
  }
  // 2. Extraire après prépositions
  const prep = /(?:à|au|en|autour de|secteur de|du côté de|du cote de|près de|pres de|dans le|dans la|côté)\s+([A-ZÀ-Ü][a-zà-ü\-]+(?:\s+[A-ZÀ-Ü][a-zà-ü\-]+)?)/g
  let m
  while ((m = prep.exec(text)) !== null) {
    const candidate = m[1].trim()
    if (candidate.length > 2) return candidate
  }
  return ''
}

// ── Détection nom entreprise ───────────────────────────────────────────────────

function detectNomEntreprise(text) {
  // Patterns: "le camping [Nom]", "hôtel [Nom]", "société [Nom]", "restaurant [Nom]"
  const patterns = [
    /(?:le|la|les|l'|au|du)?\s*(?:camping|hôtel|hotel|restaurant|gîte|gite|château|chateau|domaine|abbaye|mairie|société|societe|entreprise|agence|cabinet)\s+([A-ZÀ-Ü][^\n,.!?]{2,40})/gi,
    /(?:s'appelle|se nomme|nommé|nommee|appelé|appelee|c'est)\s+([A-ZÀ-Ü][^\n,.!?]{2,40})/gi,
    /(?:société|societe|sarl|sas|eurl)\s+([A-ZÀ-Ü][^\n,.!?]{2,40})/gi,
  ]
  for (const re of patterns) {
    const m = re.exec(text)
    if (m) return m[1].trim().replace(/\s+/g, ' ')
  }
  return ''
}

// ── Détection prénom / nom ─────────────────────────────────────────────────────

function detectContact(text) {
  const patterns = [
    /(?:contact[:\s]+|parler à|rencontré|m\.|mme|monsieur|madame)\s+([A-ZÀ-Ü][a-zà-ü\-]+)(?:\s+([A-ZÀ-Ü][A-ZÀ-Üa-zà-ü\-]+))?/gi,
  ]
  for (const re of patterns) {
    const m = re.exec(text)
    if (m) {
      return { prenom: m[1] || '', nom: m[2] || '' }
    }
  }
  return { prenom: '', nom: '' }
}

// ── Détection next step ────────────────────────────────────────────────────────

function detectNextStep(text) {
  const patterns = [
    /(rappeler?[^.!?\n]{0,60})/gi,
    /(envoyer? (?:un |le )?devis[^.!?\n]{0,60})/gi,
    /(recontacter?[^.!?\n]{0,60})/gi,
    /(faire (?:une )?visite[^.!?\n]{0,60})/gi,
    /(prendre (?:un )?(?:rdv|rendez-vous)[^.!?\n]{0,60})/gi,
    /(faire (?:une )?offre[^.!?\n]{0,60})/gi,
    /(proposer[^.!?\n]{0,60})/gi,
  ]
  for (const re of patterns) {
    const m = re.exec(text)
    if (m) {
      const step = m[1].trim()
      return step.charAt(0).toUpperCase() + step.slice(1)
    }
  }
  return ''
}

// ── Détection type besoin ──────────────────────────────────────────────────────

function detectTypeBesoin(text) {
  for (const { label, mots } of TYPES_BESOIN) {
    if (contains(text, mots)) return label
  }
  return ''
}

// ── Détection établissement ────────────────────────────────────────────────────

function detectEtablissement(text) {
  for (const { label, mots } of ETABLISSEMENTS) {
    if (contains(text, mots)) return label
  }
  return null
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORT PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

export function parseTranscription(text) {
  if (!text || !text.trim()) return { lead: {}, etablissement: null }

  const etablissement = detectEtablissement(text)

  // typeClient
  let typeClient = ''
  if (contains(text, MOTS_PARTICULIER)) {
    typeClient = 'Particulier'
  } else if (contains(text, MOTS_PROFESSIONNEL) || etablissement) {
    typeClient = 'Professionnel'
  }

  // priorité
  let priorite = 'Normale'
  if (contains(text, MOTS_PRIORITE_HAUTE)) priorite = 'Haute'
  else if (contains(text, MOTS_PRIORITE_BASSE)) priorite = 'Basse'

  // niveau d'intérêt
  let niveauInteret = ''
  if (contains(text, MOTS_INTERET_FORT)) niveauInteret = 'Fort'
  else if (contains(text, MOTS_INTERET_FAIBLE)) niveauInteret = 'Faible'

  // commentaires : uniquement enrichissements heuristiques
  const commentaires = etablissement
    ? `Type établissement détecté : ${etablissement}`
    : ''

  // message : transcription brute tronquée
  const message = text.slice(0, 500)

  const { prenom, nom } = detectContact(text)

  const lead = {
    prenom,
    nom,
    email:         detectEmail(text),
    telephone:     detectTelephone(text),
    nomEntreprise: detectNomEntreprise(text),
    typeClient,
    prestataire:   false,
    ville:         detectVille(text),
    typeBesoin:    detectTypeBesoin(text),
    message,
    source:        'Autre',       // 'Autre' = "Terrain" dans l'UI
    statut:        'nouveau',
    priorite,
    niveauInteret,
    probabilite:   '',
    nextStep:      detectNextStep(text),
    dateRelance:   null,
    dateDevis:     null,
    montantDevis:  '',
    commentaires,
  }

  return { lead, etablissement }
}
