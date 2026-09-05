/** Adapter boundary: request owns provider, timeout, usage accounting, and secrets.
 * Only JSON/validation failures receive one retry; transport errors propagate.
 * Never return or log the raw rejected response.
 */
export async function requestValidatedJson({ request, prompt, validate }) {
  let current = prompt
  for (let attempt = 0; attempt < 2; attempt++) {
    const raw = await request(current)
    try {
      if (typeof raw !== 'string' || raw.length > 200000) throw new Error('INVALID_JSON_SIZE')
      return validate(JSON.parse(raw))
    } catch (error) {
      if (attempt === 1) throw new Error('LLM_INVALID_OUTPUT')
      // Never echo untrusted output or arbitrary validation messages into prompts.
      const paths = Array.isArray(error.issues) ? error.issues.slice(0, 8).map(issue => issue.path.join('.')).join(', ') : ''
      current = { ...prompt, user: `${prompt.user}\nLa sortie précédente a échoué à la validation JSON/contrat ou à la cohérence des preuves. Régénère entièrement le JSON en respectant le contrat.${paths ? ` Champs à vérifier : ${paths}.` : ''}` }
    }
  }
}
