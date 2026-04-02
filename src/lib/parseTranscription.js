// ─────────────────────────────────────────────────────────────────────────────
// parseTranscription — heuristique pure, sans side effects, sans IA payante
// Retourne { lead: {...}, etablissement: string|null }
// ─────────────────────────────────────────────────────────────────────────────

// ── Helpers ────────────────────────────────────────────────────────────────────

function normalize(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['']/g, "'")
}

function contains(text, mots) {
  const n = normalize(text)
  return mots.some(m => n.includes(normalize(m)))
}

// ── Dictionnaires ──────────────────────────────────────────────────────────────

// Mots-clés d'établissements (ordre : plus long en premier pour "auberge de jeunesse" > "auberge")
const ETAB_KEYWORDS = [
  { label: 'auberge',          pattern: /auberge(?:\s+de\s+jeunesse)?/i },
  { label: 'camping',          pattern: /camping|terrain\s+de\s+camping/i },
  { label: 'hôtel',            pattern: /h[oô]tel|lodge/i },
  { label: 'château',          pattern: /ch[aâ]teau|manoir|bastide/i },
  { label: 'domaine viticole', pattern: /domaine|vignoble|cave\s+(?:coop|vitic)/i },
  { label: 'gîte',             pattern: /g[iî]te|chambre[s]?\s+d['']h[oô]te/i },
  { label: 'église',           pattern: /[eé]glise|cath[eé]drale|abbaye|prieur[eé]/i },
  { label: 'restaurant',       pattern: /restaurant|brasserie|bistrot?|auberge\s+(?!de\s+jeunesse)|traiteur/i },
  { label: 'mairie',           pattern: /mairie|commune\b|collectivit[eé]|communaut[eé]\s+de\s+communes/i },
  { label: 'site touristique', pattern: /grotte|gouffre|zoo|parc\s+(?:naturel|d'attraction)|mus[eé]e|monument/i },
  { label: 'entreprise',       pattern: /entreprise|soci[eé]t[eé]|sarl|sas[u]?|eurl|holding|cabinet\s+(?!m[eé]d)|agence\b/i },
  { label: 'commerce',         pattern: /boutique|magasin\b|[eé]picerie|boulangerie|pharmacie/i },
]

const MOTS_PROFESSIONNEL = [
  'camping', 'hôtel', 'hotel', 'lodge', 'restaurant', 'brasserie', 'bistro', 'bistrot',
  'auberge', 'château', 'manoir', 'domaine', 'gîte', 'gite', 'mairie', 'commune', 'association',
  'entreprise', 'société', 'sarl', 'sas', 'sasu', 'eurl', 'artisan', 'boutique', 'agence',
  'cabinet', 'clinique', 'musée', 'vignoble', 'cave', 'abbaye', 'prieuré', 'cathédrale',
  'grotte', 'zoo', 'parc', 'office de tourisme', 'maison de retraite', 'ehpad', 'syndicat',
  'communauté', 'collectivité', 'promoteur', 'immobilier', 'commerce', 'magasin',
  'église', 'eglise',
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
  'Cahors', 'Gourdon', 'Figeac', 'Souillac', 'Le Buisson', 'Buisson-de-Cadouin',
  'Saint-Chamassy', 'Montignac-Lascaux', 'Les Milandes',
]

const TYPES_BESOIN = [
  { label: 'drone',          mots: ['drone', 'aérien', 'aerien', 'survol', 'prise de vue aérienne', 'vue du ciel', 'fpv', 'vol'] },
  { label: 'vidéo',          mots: ['vidéo', 'video', 'film', 'tournage', 'reportage', 'clip', 'rushe', 'montage', 'documentaire', 'pub', 'promo', 'publicité', 'publicite', 'spot'] },
  { label: 'photo',          mots: ['photo', 'photographie', 'shooting', 'cliché', 'portraits', 'prise de vue'] },
  { label: 'corporate',      mots: ['corporate', 'institutionnel', 'présentation entreprise', 'communication interne', 'teaser', 'marque employeur'] },
  { label: 'événementiel',   mots: ['événement', 'evenement', 'event', 'soirée', 'soiree', 'cérémonie', 'ceremonie', 'gala', 'concert', 'spectacle'] },
]

const MOTS_PRIORITE_HAUTE = [
  'urgent', 'urgence', 'dès que possible', 'des que possible', 'asap', 'rapidement', 'très vite',
  'cette semaine', 'ce mois', 'prioritaire', 'impératif', 'imperatif', 'absolument', 'vite',
  'cette saison', 'cet été', 'cet ete', 'avant l\'été', 'avant lete',
]
const MOTS_PRIORITE_BASSE = [
  'pas urgent', 'plus tard', 'éventuellement', 'eventuellement', 'à terme', 'a terme',
  'dans quelques mois', 'dans plusieurs mois', 'dans un an', 'à l\'avenir', 'prochaine saison',
]

// Négations explicites — à tester AVANT les listes positives
const PAS_INTERESSE = [
  'pas intéressé', 'pas interesse', 'non intéressé', 'non interesse',
  'pas intéressée', 'pas interessee', "n'est pas intéressé", "n est pas interesse",
  'intéresse pas', 'interesse pas', 'pas vraiment intéressé', 'pas vraiment interesse',
  'pas du tout intéressé', 'pas du tout interesse',
]

const MOTS_INTERET_FORT = [
  'très intéressé', 'tres interesse', 'super intéressé', 'enthousiaste', 'ravi', 'enchanté',
  'on fonce', 'partant', 'validé', 'valide', 'accord de principe', 'il veut', 'elle veut',
  'vraiment motivé', 'banco', 'deal', 'super motivé', 'intéressé', 'interesse', 'intéressée',
]
const MOTS_INTERET_FAIBLE = [
  'pas sûr', 'pas sur', 'hésite', 'hesite', 'réfléchit', 'reflechit', 'peut-être', 'peut etre',
  'on verra', 'doute', 'peu convaincu', 'pas convaincu', 'mitigé', 'réticent',
  'pas très chaud', 'pas trop', 'à voir',
]

const MOTS_PRESTATAIRE = [
  'déjà un prestataire', 'deja un prestataire', 'déjà quelqu\'un', 'déjà un drone',
  'déjà un télépilote', 'deja un telepilote', 'ont déjà', 'a déjà un', 'déjà équipé',
  'prestataire existant', 'travaillent déjà avec',
]

// Verbes qui indiquent la fin du nom d'établissement (début d'une proposition verbale)
const STOP_VERBES = /\s+(?:souhaite[nt]?|veule?n?t?|veut|ont\b|a\b|ait\b|dit\b|cherche[nt]?|propose[nt]?|est\b|sont\b|fait\b|font\b|parle[nt]?|demande[nt]?|n[''](?:a|est|ont)|nous\b|car\b|donc\b|mais\b|qui\b|avec\b|pour\b|ne\b)\b/i

// ── Mapping label détecté → valeur enum type_etablissement ────────────────────
const ETAB_LABEL_TO_ENUM = {
  'camping':          'camping',
  'hôtel':            'hotel',
  'auberge':          'auberge',
  'château':          'chateau',
  'domaine viticole': 'domaine',
  'gîte':             'auberge',       // gîte ≈ auberge pour la segmentation
  'église':           'site_touristique',
  'site touristique': 'site_touristique',
  'restaurant':       'entreprise',
  'mairie':           'entreprise',
  'commerce':         'entreprise',
  'entreprise':       'entreprise',
}

function labelToEnum(label) {
  if (!label) return null
  return ETAB_LABEL_TO_ENUM[label] ?? 'autre'
}

// ── Détection établissement + nom complet ──────────────────────────────────────

function detectEtablissementInfo(text) {
  for (const { label, pattern } of ETAB_KEYWORDS) {
    const m = text.match(pattern)
    if (!m) continue

    // Extraire depuis le début du mot-clé jusqu'au premier verbe ou ponctuation
    const slice = text.slice(m.index)
    const nom = slice
      .split(STOP_VERBES)[0]   // coupe au premier verbe
      .replace(/[.!?,;].*$/, '') // coupe à la ponctuation
      .trim()

    return { label, nom: nom.length > 3 ? nom : '' }
  }
  return { label: null, nom: '' }
}

// ── Détection ville ────────────────────────────────────────────────────────────

function detectVille(text) {
  // 1. Dictionnaire Périgord
  for (const v of VILLES_PERIGORD) {
    if (normalize(text).includes(normalize(v))) return v
  }
  // 2. Après prépositions
  const prep = /(?:à|au|en|de\s+|autour\s+de|secteur\s+de|du\s+côté\s+de|près\s+de|dans\s+le|dans\s+la|côté)\s+([A-ZÀ-Ü][a-zà-ü\-]+(?:\s+[A-ZÀ-Ü][a-zà-ü\-]+)?)/g
  let m
  while ((m = prep.exec(text)) !== null) {
    const candidate = m[1].trim()
    if (candidate.length > 2) return candidate
  }
  return ''
}

// ── Détection prénom / nom ─────────────────────────────────────────────────────

function detectContact(text) {
  // "rencontré le gérant Thomas" → on permet un article+rôle optionnel entre le trigger et le prénom
  // [^\s]+ au lieu de \w+ car \w ne couvre pas les caractères accentués (gérant, directeur, etc.)
  const re = /(?:\bcontact[:\s]+|\bparl[eé]r?\s+[aà]|\brencontré[e]?(?:\s+(?:le|la|les|l[''])\s*[^\s]+)?|\b[Mm]\.|\b[Mm]me\b|\b[Mm]onsieur\b|\b[Mm]adame\b)\s+([A-ZÀ-Ü][a-zà-ü\-]+)(?:\s+([A-ZÀ-Ü][A-ZÀ-Üa-zà-ü\-]+))?/g
  const m = re.exec(text)
  return m ? { prenom: m[1] || '', nom: m[2] || '' } : { prenom: '', nom: '' }
}

// ── Détection email ────────────────────────────────────────────────────────────

function detectEmail(text) {
  const m = text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/i)
  return m ? m[0] : ''
}

// ── Détection téléphone ────────────────────────────────────────────────────────

function detectTelephone(text) {
  const m = text.match(/(?:(?:\+|00)33[\s.\-]?)?0?[1-9](?:[\s.\-]?\d{2}){4}/)
  if (!m) return ''
  return m[0].replace(/[\s.\-]/g, '').replace(/^0033/, '+33').replace(/^33/, '+33')
}

// ── Détection type besoin ──────────────────────────────────────────────────────

function detectTypeBesoin(text) {
  // Supprimer les contextes négatifs avant scoring :
  // 1. "pas intéressé par le drone", "non convaincu par la photo" → retire mot + objet du refus
  // 2. "pas drone", "sans vidéo", "ni photo" → retire le mot nié
  // L'ordre compte : step 1 traite les constructions "pas X par le Y" AVANT que step 2
  // ne retire seulement "X", ce qui laisserait "par le Y" isolé à tort.
  const cleaned = normalize(text)
    .replace(/(?:pas|non)\s+\S+\s+par\s+(?:le|la|les|un|une)\s+\S+/g, ' ')
    .replace(/(?:pas|sans|ni|non)\s+\S+/g, ' ')
  let bestLabel = 'drone'
  let bestScore = 0
  for (const { label, mots } of TYPES_BESOIN) {
    const score = mots.reduce((n, m) => n + (cleaned.includes(normalize(m)) ? 1 : 0), 0)
    if (score > bestScore) { bestScore = score; bestLabel = label }
  }
  return bestLabel
}

// ── Détection next step ────────────────────────────────────────────────────────

function detectNextStep(text) {
  const patterns = [
    /(rappeler?[^.!?\n]{0,60})/gi,
    /(envoyer? (?:un |le |une )?(?:devis|proposition|propale|offre)[^.!?\n]{0,60})/gi,
    /(recontacter?[^.!?\n]{0,60})/gi,
    /(faire (?:une )?visite[^.!?\n]{0,60})/gi,
    /(prendre (?:un )?(?:rdv|rendez-vous)[^.!?\n]{0,60})/gi,
    /(voir avec (?:la )?direction[^.!?\n]{0,40})/gi,
    /(proposer[^.!?\n]{0,60})/gi,
    /(relancer?[^.!?\n]{0,60})/gi,
  ]
  for (const re of patterns) {
    const m = re.exec(text)
    if (m) {
      // Ignorer si l'action est précédée de "ne pas" (ex: "Ne pas relancer avant mai")
      const before = text.slice(Math.max(0, m.index - 15), m.index)
      if (/ne\s+pas\s*$/i.test(before)) continue
      const step = m[1].trim()
      return step.charAt(0).toUpperCase() + step.slice(1)
    }
  }
  return 'À relancer' // défaut : toujours un next step
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORT PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

export function parseTranscription(text) {
  if (!text || !text.trim()) return { lead: {}, etablissement: null }

  // ── Établissement : label + nom complet + enum ───────────────────────────────
  const { label: etablissement, nom: nomEtablissement } = detectEtablissementInfo(text)
  const typeEtablissement = labelToEnum(etablissement)

  // ── Négation explicite (à tester avant toute détection positive) ─────────────
  // Regex précise : "pas/non intéressé(e)(s)" NON suivi de "par" (sinon c'est un refus ciblé
  // sur un service particulier, pas un désintérêt global — ex: "pas intéressé par le drone")
  const pasInteresse = /(?:pas|non)\s+int[eé]ress[eé]e?s?(?!\s+par\b)/i.test(text)

  // ── Type client ──────────────────────────────────────────────────────────────
  let typeClient = 'Professionnel' // défaut terrain = B2B
  // Particulier seulement si pas d'établissement et mot-clé perso explicite
  if (!etablissement && contains(text, MOTS_PARTICULIER)) typeClient = 'Particulier'

  // ── Priorité ─────────────────────────────────────────────────────────────────
  let priorite = 'Normale'
  if (contains(text, MOTS_PRIORITE_HAUTE)) priorite = 'Haute'
  else if (contains(text, MOTS_PRIORITE_BASSE)) priorite = 'Basse'

  // ── Niveau d'intérêt — négation en premier ───────────────────────────────────
  let niveauInteret = ''
  if (pasInteresse) {
    niveauInteret = 'Faible'
  } else if (contains(text, MOTS_INTERET_FORT)) {
    niveauInteret = 'Fort'
  } else if (contains(text, MOTS_INTERET_FAIBLE)) {
    niveauInteret = 'Faible'
  }

  // ── Statut ───────────────────────────────────────────────────────────────────
  const statut = pasInteresse ? 'Perdu' : 'nouveau'

  // ── Prestataire existant ─────────────────────────────────────────────────────
  const prestataire = contains(text, MOTS_PRESTATAIRE)

  // ── Commentaires internes ────────────────────────────────────────────────────
  const commentaires = ''

  // ── Contact ──────────────────────────────────────────────────────────────────
  const { prenom, nom } = detectContact(text)

  // ── Nom entreprise : priorité au nom reconstruit depuis le contexte ───────────
  const nomEntreprise = nomEtablissement || ''

  const lead = {
    prenom,
    nom,
    email:         detectEmail(text),
    telephone:     detectTelephone(text),
    nomEntreprise,
    typeClient,
    prestataire,
    ville:         detectVille(text),
    typeBesoin:    detectTypeBesoin(text),
    message:       text.slice(0, 500),
    source:        'Autre',
    statut,
    priorite,
    niveauInteret,
    probabilite:       '',
    nextStep:          detectNextStep(text),
    dateRelance:       null,
    dateDevis:         null,
    montantDevis:      '',
    typeEtablissement: typeEtablissement || '',
    commentaires,
  }

  return { lead, etablissement }
}
