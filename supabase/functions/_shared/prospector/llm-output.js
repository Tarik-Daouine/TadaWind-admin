/** Adapter boundary: request owns provider, timeout, usage accounting, and secrets.
 * Only JSON/validation failures receive one retry; transport errors propagate.
 * Never return or log the raw rejected response.
 */
const VALIDATION_HINTS = {
  FACT_NOT_EXTRACTIVE: 'Chaque text fact doit être copié littéralement depuis evidence_quote, sans paraphrase, salutation ou ajout. Place les liaisons dans des segments generic séparés.',
  INCOMPLETE_GROUNDING: 'La concaténation des segments doit reproduire chaque champ, y compris chaque espace et saut de ligne.',
  INVALID_CITATION_QUOTE: 'evidence_quote doit être copié littéralement depuis content_excerpt, et claim doit être présent exactement dans le texte.',
  INVALID_CITATION_SOURCE: 'Recopie les identifiants, types et URL exacts des sources fournies.',
  UNUSED_CITATION: 'Chaque claim doit être strictement identique au text du segment factuel correspondant.',
  UNCITED_FACT: 'Chaque segment factuel doit avoir une citation pour chacun de ses source_ids.',
  INVALID_GROUNDING: 'Utilise les chemins du canal demandé et des source_ids fournis pour chaque fait.',
  NON_FACT_WITH_SOURCES: 'Les segments proposal et generic doivent avoir source_ids vide.',
  UNPERSONALIZED_VARIANT: 'Le message doit contenir au moins un fait étayé par une source.',
  MESSAGE_TOO_LONG: 'Réduis le message, le nombre de segments et de citations aux limites du contrat.',
}
/** @param {{attempt: number, code: string}} _diagnostic */
const ignoreValidationFailure = (_diagnostic) => {}
export async function requestValidatedJson({ request, prompt, validate, onValidationFailure = ignoreValidationFailure }) {
  let current = prompt
  for (let attempt = 0; attempt < 2; attempt++) {
    const raw = await request(current)
    try {
      if (typeof raw !== 'string' || raw.length > 200000) throw new Error('INVALID_JSON_SIZE')
      return validate(JSON.parse(raw))
    } catch (error) {
      const prefix = typeof error.message === 'string' ? error.message.split(':')[0] : ''
      const code = Object.hasOwn(VALIDATION_HINTS, prefix) ? prefix : Array.isArray(error.issues) ? 'SCHEMA_INVALID' : 'JSON_INVALID'
      onValidationFailure({ attempt: attempt + 1, code })
      if (attempt === 1) throw new Error('LLM_INVALID_OUTPUT')
      // Never echo untrusted output or arbitrary validation messages into prompts.
      const paths = Array.isArray(error.issues) ? error.issues.slice(0, 8).map(issue => issue.path.join('.')).join(', ') : ''
      current = { ...prompt, user: `${prompt.user}\nLa sortie précédente a échoué à la validation JSON/contrat ou à la cohérence des preuves. Régénère entièrement le JSON en respectant le contrat.${paths ? ` Champs à vérifier : ${paths}.` : ''}${VALIDATION_HINTS[code] ? ` ${VALIDATION_HINTS[code]}` : ''}` }
    }
  }
}
