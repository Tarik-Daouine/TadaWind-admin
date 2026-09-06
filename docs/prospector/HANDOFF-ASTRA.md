# Livraison Astra — 5 septembre 2026

Travail local dans la branche `claude/tada-wind-prospector-8f84b7` et son worktree. Pas encore de migration, de déploiement, de worker ni d'écran Prospection. Cette livraison couvre L3 et les bibliothèques de parsing/contrats/prompts pour L7–L10. Le scénario d'acceptation V1 complet reste à intégrer et à tester.

## Fichiers livrés

| Fichier | Usage |
|---|---|
| `src/lib/prospector/dedupe.js` | Normalisation, clé de déduplication, recherche de toutes les collisions |
| `src/lib/prospector/scoring.js` | Barème, paramètres validés, exclusions, calcul et motifs en français |
| `supabase/functions/_shared/prospector/dedupe.js`, `scoring.js` | Réexports de la logique commune ; aucune copie divergente |
| `supabase/functions/_shared/prospector/schemas.js` | Zod + vérifications de sources, stratégie et traçabilité des messages |
| `supabase/functions/_shared/prospector/prompts.js` | Prompts analyse, stratégie et rédaction ; données séparées des instructions |
| `supabase/functions/_shared/prospector/enrich.js` | Parsing HTML sans réseau ni exécution de scripts, via parse5 |
| `supabase/functions/_shared/prospector/llm-output.js` | Validation JSON et un seul retry de sortie invalide |
| `tests/unit/prospector/` | Tests de logique, cas limites, contrats, citations et parsing |
| `vitest.config.js` | Tests Node isolés des tests Playwright ; alias des imports Deno `npm:` |

Les évolutions du contrat ont été inscrites **d'abord** dans `PLAN-ACTION.md` §21. Elles portent notamment sur les informations inconnues, les tarifs non renseignés et la traçabilité de chaque segment de message.

## Intégration du scoring

```js
import { scoreProspect } from '../_shared/prospector/scoring.js'

const result = scoreProspect({
  prospect, // colonnes DB : category, is_client, contact_email, email, email_commercial…
  analysis, // AnalysisSchema validé, sources vérifiées avant ce calcul
  settings, // ligne prospector_settings
  context: {
    distance_km, // calculée côté serveur, null si inconnue
    is_closed, is_blacklisted, is_duplicate, has_contact_form,
  },
})
// Mapping DB : score=result.total, priority=result.priority,
// score_breakdown=result.breakdown, score_reasons=result.reasons.
// Conserver result complet dans prospect_events.meta pour la version du barème.
```

La note qualitative provient de l'analyse ; le calcul est ensuite déterministe. **Aucun prompt ni appel LLM pour `prospector-score`.** Une valeur qualitative manquante vaut 0 et produit un motif « donnée inconnue ». Une exclusion dure annule toutes les contributions. Les catégories doivent utiliser les mêmes identifiants que les réglages.

Les poids doivent totaliser 100. Les trois bandes SQL actuelles sans `points` utilisent 5/3/1 ; un champ `points` explicite est accepté. La pondération géographique suit ensuite `scoring_weights.geo_access`. Le rayon maximal reste une exclusion indépendante des bandes.

## Intégration de la déduplication

```js
import { normalizeProspect, buildDedupeHash, findDuplicates } from '../_shared/prospector/dedupe.js'
const normalized = normalizeProspect(candidate)
const collisions = findDuplicates(candidate, existingCandidates)
const dedupe_hash = buildDedupeHash(candidate)
```

`findDuplicates` retourne `{prospect, matched_by}[]`, où `matched_by` vaut `domain`, `phone` ou `name_city`. Ne pas choisir arbitrairement la première collision. L'email seul ne provoque pas de fusion. Le hash est une clé textuelle stable, pas un hash cryptographique. La requête DB préalable doit rechercher **tous** les signaux normalisés, pas seulement cette clé. La ville retournée par `normalizeProspect` est une clé de comparaison ; conserver la ville d'affichage originale dans la fiche.

Le champ SQL `normalized_name` étant généré, **ne pas l'inclure dans un insert/update**. Aligner d'abord la fonction SQL sur le normaliseur JS (§21), et gérer l'unicité concurrente dans L0/L11. Les numéros internationaux autres que +33 sont contrôlés syntaxiquement ; leur existence n'est pas vérifiée.

## Intégration de l'enrichissement

```js
import { parseWebsiteHtml } from '../_shared/prospector/enrich.js'
const parsed = parseWebsiteHtml(html, {
  url: finalResponseUrl,
  fetchedAt: new Date().toISOString(),
})
// parsed = {website, socials, signals, sources}
// Ajouter prospect_id aux sources ; la DB attribue id.
```

Entrée limitée à 1 000 000 caractères, extrait à 12 000 caractères. Limiter aussi les **octets reçus avant parsing** dans le fetch. La fonction ne valide pas la sûreté réseau d'une URL : SSRF, DNS, redirections, timeout, cadence, MIME et cache restent à implémenter dans l'Edge Function. Les liens sociaux sont des candidats à contrôler ; un lien ne prouve ni propriété du compte ni activité récente. Les dates sont des valeurs `<time datetime>` observées, pas une déduction de dernière activité. Les signaux du parseur sont des observations techniques, pas des signaux d'achat. Aucun HTML brut à afficher avec `dangerouslySetInnerHTML`.

Une page vide doit rester exploitable comme résultat d'enrichissement sans déclencher l'analyse : `SourceSchema` exige un extrait non vide. La validation de contexte accepte jusqu'à 100 sources ; sélectionner les extraits pertinents avant l'appel IA. Le prompt consomme les extraits, pas les objets `extracted` arbitraires : transformer les observations structurées utiles en extraits factuels côté serveur si nécessaire.

## Intégration IA et messages

```js
import { buildAnalyzePrompt } from '../_shared/prospector/prompts.js'
import { validateAnalysis } from '../_shared/prospector/schemas.js'
import { requestValidatedJson } from '../_shared/prospector/llm-output.js'

// Charger les sources en DB avec le filtre prospect_id, pas depuis le front/LLM.
const context = { sources, prospectId }
const analysis = await requestValidatedJson({
  prompt: buildAnalyzePrompt(context),
  request: callConfiguredProvider, // ({system,user}) => Promise<string JSON>
  validate: output => validateAnalysis(output, context),
})
// Persister uniquement analysis après ce retour.
```

L'adaptateur fournisseur doit gérer clés Supabase, timeout, limite de tokens, refus/troncature, modèle configurable et `ai_usage` **pour chaque appel, retry inclus**. Un échec réseau remonte au worker ; seules les erreurs JSON/contrat ont un retry interne. Le worker doit éviter de multiplier trois essais de job par deux appels sans comptabilisation. Après deux sorties invalides : `LLM_INVALID_OUTPUT`, sans réponse brute dans les logs/DB.

Pour la stratégie : `buildStrategizePrompt({...context, analysis, businessProfile, availableChannels})`, puis `validateStrategy(output, {services, availableChannels, hasReferencePrices})`. Calculer les canaux disponibles depuis les coordonnées réelles et les réglages. Sans tarifs configurés, `estimated_value_eur` doit rester `null`. Le champ facultatif `business_profile.reference_prices` fournit les références au prompt ; la conformité sémantique des estimations n'est pas contrôlée automatiquement.

Pour la rédaction : `buildCopywritePrompt({...context, analysis, strategy, businessProfile, availableChannels, tone})`, puis **`validateMessage(output, context)`**, et pas seulement `MessageSchema.parse`. Utiliser les données serveur validées et un profil TW administré. Les imports Deno npm sont épinglés ; Zod/parse5 sont en dev-dependencies Node pour les tests et n'entrent pas dans le bundle React actuel.

Chaque message produit quatre variantes. Le serveur vérifie : contexte de prospect, IDs/types/URLs exacts, citation littérale présente dans l'extrait, claim présent dans le message, couverture exacte de tous les champs texte par `grounding`, et citations pour chaque segment déclaré factuel. **Cela ne prouve pas qu'une citation implique le fait ni que le LLM a correctement classé tous les segments.** La validation humaine reste obligatoire, avec les preuves visibles. Les `tone_check` sont aussi des déclarations du modèle, pas une certification.

À l'insertion : une ligne `prospect_messages` par variante, `status='draft'`, filtrer `sources_used` et `grounding` selon le préfixe de variante. Stocker `grounding`, `tone_check`, `confidence` et le script téléphone structuré dans `variables` (JSONB déjà présent). Ne jamais déduire `approved` du résultat du validateur. Une édition doit invalider l'approbation et revalider/reconstruire la traçabilité ; ne pas conserver de citations périmées.

## Vérifications effectuées

- `npm test` : 94 tests unitaires réussis.
- `npm run build` : réussi (avertissement de bundle >500 kB dans l'app existante).
- `npx --yes --package deno deno check --no-lock supabase/functions/_shared/prospector/{schemas,prompts,enrich,scoring,dedupe,llm-output}.js` : les six modules résolus avec succès, via chemins explicites sous PowerShell. Cela ne constitue pas un test de déploiement Supabase.
- `npm audit` : 7 alertes sur des dépendances présentes dans le lockfile initial (Babel, Browserslist, esbuild, nanoid, PostCSS, Vite, ws). Aucun upgrade majeur entrepris dans ce lot. La mise à niveau de Vite mérite un lot séparé.
- Pas d'e2e Prospection à ce stade : les écrans, l'authentification des fonctions, les migrations et le pipeline ne sont pas livrés ici. Aucun appel IA payant et aucun message commercial envoyés.

## Suite pour Claude Code

Finaliser L0 en traitant les risques du plan §21.1 : transitions de message protégées, normalisation SQL cohérente, collisions, claim/reprise atomiques des jobs, version du score et contraintes des réglages. Brancher ensuite L1–L2/L4–L6 et les bibliothèques ci-dessus sur L7–L10. Vérifier le déploiement du graphe d'import commun avec le bundler Supabase, puis exécuter le scénario d'acceptation V1. Clé IA, budget et identifiants de modèles restent à configurer/vérifier côté serveur.
