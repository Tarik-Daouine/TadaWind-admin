# Tada Wind Prospector — Plan d'action

> **Statut (2026-09-05, reprise Claude Code) :** L0 · L1–L2 (nav + Réglages) · L3 (lib scoring/dedupe) · L4–L5 (Prospects + fiche) · L6–L7 (queue + worker + enrichissement) · **L11** (campagne OSM → worker `discovery` → prospects + `distance_km`) · **L8–L10** (chaîne worker `analyze → score(SQL) → strategize → copywrite → to_validate`, adaptateur LLM Anthropic dans `_shared/prospector/llm-provider.ts`, sorties validées Zod + preuves vérifiées en base). Edge Functions `prospector-worker` v5 / `prospector-enrich` v3 déployées.
> Restent : **UI file « À valider » / éditeur-approbation de message / Dashboard** (les RPC existent). **Secrets à poser :** `ANTHROPIC_API_KEY` + modèle dans Réglages (défauts posés : `claude-sonnet-5` / `claude-haiku-4-5`) → active la chaîne IA ; secret GitHub `PROSPECTOR_CRON_SECRET` → active le cron worker. Sans clé LLM : `analyze` échoue en `LLM_NOT_CONFIGURED` (terminal), le prospect reste `to_analyze`.
> Document destiné à être partagé entre agents IA (Claude Code + « ChatGPT Astra ») et validé par Tarik.
> Toute décision marquée ⚠️ doit être tranchée par Tarik avant le lot concerné.

---

## 0. But de ce document

Servir de **source de vérité unique** pour construire le module *Tada Wind Prospector* à l'intérieur de l'app existante **TadaWind-admin**, en :

- figeant l'état technique réel du projet (inspecté le 2026-09-05) ;
- fixant l'architecture cible et les contrats d'interface ;
- découpant le travail en lots livrables et testables ;
- listant ce qui reste à décider.

Le module doit devenir un **assistant commercial semi-autonome** : il cherche, enrichit, analyse, score, rédige, suit et relance — **mais n'envoie jamais un premier message sans validation humaine**.

---

## 1. Contexte business (résumé)

Tada Wind = prestations de contenu visuel **drone + sol** : vidéo promotionnelle, immobilier, tourisme, hôtellerie, restauration, domaines, événementiel, contenus réseaux sociaux, photo complémentaire.

Zone : locale / régionale (Périgord–Dordogne, base à préciser, probablement **Sarlat-la-Canéda** ⚠️), extensible.

Problème résolu : la prospection manuelle (chercher les entreprises, visiter leurs sites, regarder Instagram, écrire chaque message) prend trop de temps → elle n'est pas faite régulièrement. Objectif : **80–90 % du travail préparatoire fait par l'IA**, Tarik ne fait plus que décider / valider / vendre.

Cibles prioritaires : agences & promoteurs immobiliers, hôtels, campings, chambres d'hôtes, gîtes, domaines, châteaux, lieux de mariage, restaurants & bars au cadre remarquable, offices de tourisme, activités & parcs de loisirs, accrobranche, bases nautiques, golfs, centres équestres, organisateurs d'événements, BTP avec réalisations visuelles, architectes, concessions auto, patrimoine, collectivités (si pertinent), tout site photogénique. Le système doit aussi **découvrir de nouvelles catégories**.

---

## 2. État des lieux technique (inspecté)

### 2.1 Stack

| Couche | Réalité |
|---|---|
| Front | **React 18.3 + Vite 5**, **JavaScript pur** (aucun TypeScript), modules ESM |
| Routing | **Aucun routeur**. Navigation = `useState('view')` dans `src/App.jsx`, valeurs : `projects \| medias \| leads \| analytics \| settings` |
| Styles | **CSS-in-JS inline** (objets `style={{}}`) + **design tokens CSS** dans `src/styles/globals.css` (`:root`). **Thème sombre unique.** Polices : `DM Serif Display` (titres), `Inter` (corps) |
| Composants UI | `src/components/ui/` : `Badge`, `Button`, `Input`, `Modal`, `Toast`, `SectionCard`, `ThemedDateInput` |
| State/données | Hooks maison `src/hooks/useX.js` → appellent **directement** `supabase.from(...)` + mapping colonnes ↔ UI. Pas de React Query, pas de store global |
| Backend applicatif | **INEXISTANT.** Pas de serveur Node. Tout est fait côté client contre Supabase |
| BaaS | **Supabase** : Postgres + Auth (email/mot de passe, `onAuthStateChange`) + Edge Functions (Deno) + Storage |
| Auth | `src/hooks/useAuth.js` — session Supabase persistée en `localStorage`, 1 seul admin de fait. RLS activé sur les tables |
| Edge Functions déployées | `vercel-analytics` (active), `streamable-list` (obsolète, renvoie 410) |
| Déploiement | **GitHub Pages statique**. `.github/workflows/deploy.yml` : `npm ci && npm run build` puis `deploy-pages`. `base: '/TadaWind-admin/'` dans `vite.config.js` |
| Secrets CI présents | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (GitHub Secrets, injectés au build) |
| Cron déjà en place | `.github/workflows/supabase-keepalive.yml` : ping REST quotidien 05h30 UTC pour éviter la pause du free tier |
| Tests | **Playwright e2e uniquement** (`tests/e2e/*.spec.js`), config `playwright.config.js`. **Aucun test unitaire**, aucun runner unitaire installé |

### 2.2 Base de données actuelle (schéma `public`)

**`projects`** (RLS on) — portfolio : `id uuid pk`, `title`, `status ('draft'|'published'|'archived')`, `category`, `order`, `location`, `objectif`, `livrables`, `streamableid/url/meta`, `cover`, `gallery jsonb`, `thumb`, `url`, `slug unique`, `tags text[]`, `region`, `long_desc`, `seo_title`, `seo_desc`, `featured bool`, `created_at`, `updated_at`.

**`leads`** (RLS on) — **mini-CRM déjà existant**. Colonnes = **identifiants français entre guillemets** (douloureux à requêter). Champs : `ID text pk`, `Prenom`, `Nom`, `Email`, `Telephone`, `Nom entreprise`, `Type de client ('Particulier'|'Professionnel')`, `Prestataire existant bool`, `Ville / Lieu mission`, `Date souhaitee mission`, `Type de besoin`, `Message client`, `Source ('tadawind_site'|'Autre'|'Réseau')`, `Statut ('nouveau'|'Prospect contacté'|'À relancer'|'Opportunité'|'Relancé'|'Converti'|'Perdu')`, `Priorite`, `Niveau interet`, `Probabilite`, `Next step`, `Date de relance`, `Date envoi devis`, `Montant devis estime`, `montant_reel numeric`, `type_etablissement`, `Commentaires internes`, `Timestamp`.

**`settings`** : référencée par `src/components/settings/SettingsPage.jsx` mais **la table n'existe pas encore** (le code gère l'absence).

### 2.3 Brique CRM/IA déjà présente (à réutiliser comme modèle, pas à dupliquer)

- `src/components/leads/LeadsList.jsx` : **datatable** avec recherche, filtres (dropdowns pills), tri, pagination (`PAGE_SIZE = 15`), quick views.
- `src/lib/leadViews.js` : **quick views** déclaratives (`LEAD_QUICK_VIEWS`, `matchesLeadQuickView`, `countLeadsForQuickView`) — modèle direct pour la vue « Ce que je dois faire maintenant ».
- `src/components/leads/LeadDetail.jsx` : panneau détail éditable.
- `src/components/leads/LeadChatbot.jsx` + `src/lib/parseTranscription.js` : extraction d'infos depuis une note terrain, **heuristique pure, sans IA payante**. Montre le pattern **saisie → prévisualisation → validation** attendu pour la file « À valider ».
- `src/components/analytics/AnalyticsDashboardPage.jsx` : cartes de stats, à reprendre pour le Dashboard Prospection.
- `src/components/layout/Sidebar.jsx` : `NAV_ITEMS` avec `badge` (compteur) — ajouter l'entrée `prospection`.

### 2.4 Contraintes structurantes

1. **Pas de backend = tout secret/appel sensible passe par Edge Function Deno.** Interdiction absolue de mettre une clé LLM ou Places dans le front (`import.meta.env.VITE_*` est public).
2. **Front 100 % statique** servi sur GitHub Pages → pas de SSR, pas de route API locale. Les jobs longs ne peuvent pas tourner « dans le front ».
3. **JavaScript, pas TypeScript** dans le front. Les Edge Functions Deno **peuvent** être en TS (recommandé pour la validation de schéma).
4. **RLS activé** : toute nouvelle table doit avoir des policies (voir §5.4). Politique retenue : accès complet aux utilisateurs `authenticated`, aucun accès `anon`.
5. Le worker de jobs a besoin d'un déclencheur : `pg_cron` **ou** un workflow GitHub Actions (le pattern keepalive existe déjà).

---

## 3. Principes directeurs (non négociables)

| # | Principe | Traduction technique |
|---|---|---|
| P1 | **Human-in-the-loop avant tout 1er contact** | Un `prospect_message` de type `first_touch` ne peut passer qu'au statut `draft → approved → sent`. `sent` n'est atteignable **que** par une action utilisateur explicite. Aucune Edge Function n'envoie de message. |
| P2 | **Zéro hallucination** | Toute phrase personnalisée du message doit référencer au moins une `prospect_source` (id + type + url). Le copywriter reçoit **uniquement** des faits extraits et horodatés ; il n'a pas accès au web. Section interne « Sources utilisées » stockée avec le message. |
| P3 | **Sorties IA structurées & validées serveur** | Chaque appel LLM renvoie un JSON conforme à un schéma (Zod côté Edge Function). Réponse non conforme → 1 retry avec message d'erreur, puis échec propre du job (jamais de donnée brute persistée). |
| P4 | **Secrets backend-only** | `ANTHROPIC_API_KEY` (⚠️ à fournir), éventuelles clés Places/Maps : **Supabase → Edge Functions → Secrets**. Jamais dans le repo, jamais dans le build front. |
| P5 | **Maîtrise des coûts** | Cache des fetch web (par URL + TTL), dédup avant analyse, analyse progressive (enrich léger → filtre → analyse LLM seulement si pré-score OK), Haiku pour tâches simples / Sonnet pour analyse complexe, table `ai_usage` (tokens + coût estimé, par prospect et par campagne). |
| P6 | **RGPD / prospection B2B responsable** | Coordonnées **professionnelles publiques** uniquement. Champs `data_origin`, `collected_at`, `last_verified_at`. Blacklist / opt-out définitif par entreprise. Suppression complète d'un prospect (hard delete + purge sources). Pas de contournement de protections techniques, pas de scraping agressif de réseaux sociaux. |
| P7 | **Ne rien casser** | Aucune modification des tables `projects` / `leads`. Nouvelles tables préfixées `prospect_` / `prospector_`. Nouvelle vue isolée dans la nav. Pas d'ajout de dépendance lourde au front (pas de react-router). |
| P8 | **Scoring transparent** | Jamais de score sans ventilation. Le barème (§8) est stocké en config, versionné, et affiché à côté du score. |

---

## 4. Architecture cible

```
┌─────────────────────────── FRONT (React/Vite, statique, GitHub Pages) ───────────────────────────┐
│  Sidebar → "Prospection"                                                                          │
│  src/components/prospector/                                                                        │
│    ProspectorApp.jsx        (sous-navigation interne : dashboard|search|prospects|validate|...)    │
│    DashboardProspection.jsx                                                                        │
│    SearchCampaign.jsx        (formulaire critères → crée un job discovery)                          │
│    ProspectsTable.jsx        (datatable, calquée sur LeadsList)                                     │
│    ProspectDetail.jsx        (onglets Résumé/Analyse/Présence/Opportunités/Messages/Historique/Notes)│
│    ValidationQueue.jsx       (file "À valider" + mode batch)                                        │
│    ProspectorSettings.jsx    (profil commercial Tada Wind, seuils, rayons, exclusions)             │
│  src/hooks/                                                                                        │
│    useProspects.js  useProspectorJobs.js  useProspectorSettings.js  useProspectCampaigns.js        │
│  src/lib/prospector/                                                                               │
│    api.js            (wrappers fetch vers les Edge Functions)                                       │
│    scoring.js        (mêmes constantes que le back — barème, seuils priorité, libellés)            │
│    dedupe.js         (normalisation nom/téléphone/domaine — utilisé aussi pour l'ajout manuel)     │
└──────────────────────────────────────────────┬───────────────────────────────────────────────────┘
                                               │  supabase-js (anon key + session JWT)
                    ┌──────────────────────────┴───────────────────────────┐
                    │                                                      │
        ┌───────────▼───────────┐                          ┌───────────────▼────────────────┐
        │   Postgres (Supabase) │                          │   Edge Functions (Deno/TS)     │
        │   nouvelles tables    │◄────service_role────────►│   prospector-discovery         │
        │   §5                   │   (worker uniquement)    │   prospector-enrich            │
        │   + RLS authenticated │                          │   prospector-analyze          │
        │   + pg_cron (worker)  │                          │   prospector-score            │
        └───────────────────────┘                          │   prospector-strategize       │
                                                           │   prospector-copywrite        │
                                                           │   prospector-crm-next         │
                                                           │   prospector-worker  (cron)   │
                                                           │   prospector-manual-analyze   │
                                                           └───────────────┬────────────────┘
                                                                           │ HTTPS
                                    ┌──────────────────────────────────────┼───────────────────────┐
                                    ▼                    ▼                  ▼                       ▼
                             Anthropic API        Overpass/OSM      Nominatim (geocode)     fetch(site web)
                             (Claude Haiku/Sonnet)  (découverte POI)  (distance)             (enrichissement)
```

### 4.1 Frontend — intégration

- **Sidebar** : ajouter `{ id: 'prospection', label: 'Prospection', icon: <IconTarget />, badge: aValiderCount }` dans `NAV_ITEMS` (`src/components/layout/Sidebar.jsx`).
- **App.jsx** : ajouter `view === 'prospection' && <ProspectorApp onToast={addToast} />`.
- **Sous-navigation** : dans `ProspectorApp.jsx`, un `useState('subview')` local (pas de routeur). Sous-vues : `dashboard`, `search`, `prospects`, `validate`, `contacted`, `followups`, `opportunities`, `campaigns`, `settings`. (« À analyser / Réponses / Archivés » = filtres/quick-views de `prospects`, pas des écrans distincts, pour rester léger.)
- **Réutilisation stricte** : `Badge`, `Button`, `Input`, `Modal`, `Toast`, `SectionCard`, tokens `globals.css`, pattern liste+détail, pagination `PAGE_SIZE`, dropdowns pills de `LeadsList`.

### 4.2 Edge Functions — responsabilités

| Fonction | Rôle | Entrées | Sorties (schéma validé) | LLM |
|---|---|---|---|---|
| `prospector-discovery` | Interroge Overpass/OSM (+ géocode via Nominatim) selon critères de campagne. Crée/queue des prospects candidats. **Dédup avant insert.** | `campaign_id` | liste `{name, category, address, lat, lng, website?, phone?}` + rapport (trouvés / dédupliqués / insérés) | non |
| `prospector-enrich` | Récupère le site web (fetch + parse : titre, meta, présence vidéo/`<video>`/YouTube/Vimeo embeds, liens réseaux sociaux, dernière date visible, qualité perçue des images). Best-effort réseaux via pages publiques. Écrit des `prospect_sources`. | `prospect_id` | `{website:{...}, socials:{...}, signals:[...], sources:[...]}` | non (ou Haiku pour résumé court) |
| `prospector-analyze` | Comprend l'activité : positionnement, cible, dépendance au visuel, état marketing, opportunités de contenu. **N'a que les faits `prospect_sources`.** | `prospect_id` + faits | `AnalysisSchema` (§6.3) | Sonnet |
| `prospector-score` | Applique le barème §8 sur l'analyse + distance + signaux. Déterministe (pas de LLM) : le LLM a déjà fourni des sous-notes qualitatives, ici on agrège et on borne. | `prospect_id` | `ScoreSchema` (breakdown + total + priorité + raisons) | non |
| `prospector-strategize` | 1 à 3 angles commerciaux + prestations Tada Wind recommandées + objections probables + arguments. | `prospect_id` + analyse + profil TW | `StrategySchema` | Sonnet |
| `prospector-copywrite` | Génère les variantes de message (email / DM Instagram / LinkedIn / script téléphone) à partir **des faits + angles**. Chaque assertion → source. | `prospect_id` + faits + strategy + profil TW + ton | `MessageSchema` (variantes + `sources_used[]`) | Sonnet |
| `prospector-crm-next` | Détermine la prochaine étape CRM / la prochaine action recommandée. | `prospect_id` + historique | `{next_status?, next_action, next_action_at?, rationale}` | Haiku |
| `prospector-manual-analyze` | Point d'entrée « Analyser ce prospect » (ajout manuel) : enchaîne enrich → analyze → score → strategize → copywrite en un job. | `{name?, url?, instagram?, address?}` | `job_id` | — |
| `prospector-worker` | Consomme `prospect_jobs` (statut `queued`), exécute l'étape, gère retry/timeout/erreurs, journalise, enchaîne les jobs suivants. Déclenché par `pg_cron` toutes les minutes (ou GitHub Actions). | — | — | — |

> Toutes les fonctions : `verify_jwt = true` sauf `prospector-worker` (appelée par cron avec un secret dédié `PROSPECTOR_CRON_SECRET`). Le worker utilise la `service_role` key (secret) pour écrire sans contrainte RLS.

### 4.3 Jobs asynchrones

- Table `prospect_jobs` (§5) : `type`, `status (queued|running|done|error)`, `payload jsonb`, `result jsonb`, `attempts`, `max_attempts (3)`, `run_after timestamptz`, `error text`, `prospect_id`, `campaign_id`.
- `prospector-worker` : `SELECT ... FOR UPDATE SKIP LOCKED LIMIT 5` ; timeout par job (ex. 60 s) ; backoff : `run_after = now() + attempts * interval '2 min'`.
- Enchaînement pipeline : à la fin de `discovery`, un job `enrich` par prospect ; fin `enrich` → `analyze` (si pré-filtre distance/catégorie OK) → `score` → `strategize` → `copywrite` → prospect passe en `to_validate`.
- L'UI (`useProspectorJobs`) affiche l'avancement (polling léger toutes les 5 s tant qu'il y a des jobs actifs, sinon rien).

### 4.4 Secrets (Supabase → Edge Functions → Secrets)

| Secret | Obligatoire | Usage |
|---|---|---|
| `ANTHROPIC_API_KEY` | ⚠️ **oui** (bloquant pour tout ce qui est IA) | analyze / strategize / copywrite / crm-next |
| `SUPABASE_SERVICE_ROLE_KEY` | oui | worker (écriture hors RLS) — déjà dispo dans l'env des Edge Functions |
| `PROSPECTOR_CRON_SECRET` | oui | authentifie l'appel cron du worker |
| `GOOGLE_MAPS_API_KEY` | non (V2) | upgrade découverte (Places) + temps de trajet |
| `NOMINATIM_USER_AGENT` | recommandé | politesse API OSM (email de contact) |

---

## 5. Modèle de données (nouvelles tables)

> Convention : **snake_case anglais** (cohérent avec `projects`, et bien plus maniable que les identifiants FR de `leads`). SQL complet et exécutable → `docs/prospector/schema.sql`. Résumé ci-dessous.

### 5.1 Tables

**`prospector_settings`** (singleton, `id text pk default 'main'`)
Profil commercial Tada Wind + paramètres. Colonnes clés :
`business_profile jsonb` (services, positioning, targetCustomers, preferredAreas, portfolio[], contactInfo, pitchNotes),
`reference_address text`, `reference_lat/lng`, `radius_preferred_km int`, `radius_max_km int`,
`min_score int`, `priority_thresholds jsonb` (`{hot:80, good:60, consider:40, low:20}`),
`distance_bands jsonb`, `enabled_categories text[]`, `disabled_categories text[]`,
`followup_delays_days int[]` (`{3,7,14}`), `ai_model_simple text`, `ai_model_complex text`, `tone text`,
`channels jsonb` (email/instagram/linkedin/phone activés), `scoring_weights jsonb` (barème §8, versionné), `updated_at`.

**`prospects`**
`id uuid pk`, `created_at`, `updated_at`,
Identité : `name`, `normalized_name` (généré/trigger), `category`, `subcategory`, `description`,
`address`, `city`, `postal_code`, `department`, `region`, `country default 'France'`, `lat`, `lng`,
Contact : `phone`, `email`, `email_commercial`, `contact_first_name`, `contact_last_name`, `contact_role`, `contact_email`, `contact_phone`,
Présence : `website`, `website_domain` (normalisé), `instagram`, `facebook`, `linkedin`, `tiktok`, `youtube`, `other_links jsonb`,
Analyse (dernier run) : `summary`, `analysis jsonb` (AnalysisSchema), `strategy jsonb` (StrategySchema),
Scoring : `score int`, `score_breakdown jsonb`, `score_reasons text[]`, `priority text` (`hot|good|consider|low|excluded`), `weaknesses text[]`, `opportunities text[]`,
CRM : `status text` (§12), `owner text`, `discovered_at`, `last_analyzed_at`, `last_contacted_at`, `next_action text`, `next_action_at`, `next_followup_at`,
Méta : `campaign_id uuid null`, `data_origin text`, `collected_at`, `last_verified_at`, `tags text[]`, `dedupe_hash text`, `is_client bool default false`, `deleted_at`.

**`prospect_sources`** — traçabilité
`id`, `prospect_id fk`, `type text` (`website_home|website_page|instagram|facebook|linkedin|maps|osm|manual|...`), `url`, `fetched_at`, `content_excerpt text`, `extracted jsonb`, `confidence numeric` (0–1).

**`prospect_events`** — timeline
`id`, `prospect_id fk`, `created_at`, `type text` (`discovered|enriched|analyzed|scored|message_generated|message_approved|message_edited|contacted|followup_due|reply_received|status_changed|note_added|excluded|...`), `label text`, `meta jsonb`, `actor text` (`system|user`).

**`prospect_messages`**
`id`, `prospect_id fk`, `channel text` (`email|instagram_dm|linkedin|phone_script`), `kind text` (`first_touch|followup|reply_draft`), `subject text`, `body text`, `variables jsonb`, `sources_used jsonb` (liste `{source_id, url, claim}`), `status text` (`draft|approved|edited|sent|rejected|regenerate_requested`), `generated_by text`, `model text`, `created_at`, `approved_at`, `sent_at`, `sent_channel_ref text`, `rejection_reason text`.

**`prospect_campaigns`**
`id`, `name`, `filters jsonb` (catégories, rayon, score min, mots-clés, standing…), `status text` (`draft|running|paused|done`), `created_at`, `stats jsonb` (found/qualified/to_validate/contacted/replied/opportunities/potential_revenue), `notes`.

**`prospect_jobs`** — voir §4.3.

**`prospect_blacklist`**
`id`, `reason text`, `domain text`, `normalized_name text`, `phone text`, `email text`, `created_at`, `created_by text`, `source text` (`manual|opt_out|reply_negative`).

**`prospect_feedback`** — apprentissage (Phase 2/3)
`id`, `prospect_id fk`, `decision text` (`approved|rejected|later|blacklist`), `reason text` (enum §49), `note text`, `score_at_decision int`, `created_at`.

**`ai_usage`**
`id`, `created_at`, `function text`, `model text`, `prospect_id null`, `campaign_id null`, `input_tokens int`, `output_tokens int`, `cost_estimate_usd numeric`.

### 5.2 Déduplication — `dedupe_hash` & index

Signaux, par ordre de fiabilité : `website_domain` normalisé > `phone` E.164 > `normalized_name` + `city` > `email`. Une insertion `discovery` :
1. normalise les signaux ;
2. cherche un prospect existant matchant ≥ 1 signal fort (domaine/téléphone) **ou** (nom normalisé + ville) ;
3. si trouvé → **enrichit** la fiche existante (remplit les champs vides, ajoute des `prospect_sources`, événement `enriched`), n'insère pas ;
4. sinon → insert avec `dedupe_hash`.

Index : `unique (website_domain) where website_domain is not null` (partiel), `index (phone)`, `index (normalized_name, city)`, `index (dedupe_hash)`.

### 5.3 Normalisation (spécifiée dans `src/lib/prospector/dedupe.js` **et** répliquée côté Edge)

- `normalized_name` : lowercase, sans accents (NFD), retrait des formes juridiques (`sarl|sas|eurl|sasu|earl|scea|sci`), retrait ponctuation, espaces compactés.
- `website_domain` : hostname sans `www.`, lowercase, sans chemin.
- `phone` : E.164 France (`+33…`), retrait espaces/points/tirets.

### 5.4 RLS

Pour **chaque** nouvelle table :
```sql
alter table <t> enable row level security;
create policy "<t>_authenticated_all" on <t>
  for all to authenticated using (true) with check (true);
```
`prospect_jobs` : en plus, aucune policy `anon` ; le worker écrit via `service_role` (bypass RLS).

---

## 6. Contrats des sorties IA (schémas)

> Validés par **Zod** dans chaque Edge Function. Toute non-conformité → 1 retry, puis job `error`.

### 6.1 `AnalysisSchema` (prospector-analyze)
```jsonc
{
  "summary": "string (3–5 phrases, factuel)",
  "business_type": "string",
  "positioning": "premium | milieu_de_gamme | entree_de_gamme | inconnu",
  "target_customers": ["string"],
  "visual_dependency": "faible | moyenne | forte",     // à quel point l'offre repose sur le visuel
  "marketing_state": {
    "website_quality": "faible | moyenne | bonne | inconnu",
    "website_recent": "oui | non | inconnu",
    "photos_professional": "oui | non | partiel | inconnu",
    "has_video": "oui | non | inconnu",
    "has_drone": "oui | non | inconnu",
    "video_outdated": "oui | non | inconnu",
    "instagram_active": "oui | non | inconnu",
    "reels_used": "oui | non | inconnu",
    "publishing_regular": "oui | non | inconnu"
  },
  "buying_signals": [{ "type": "string", "evidence_source_id": "uuid", "weight": "faible|moyen|fort" }],
  "opportunities": ["string"],          // ex: "visite drone du domaine", "banque de Reels"
  "weaknesses": ["string"],
  "recommended_content": ["string"],
  "qualitative_scores": {               // 0–100 chacun, sert d'entrée au scorer déterministe
    "fit_tada_wind": 0, "video_need": 0, "drone_need": 0,
    "commercial_potential": 0, "digital_gap": 0
  },
  "confidence": 0.0,
  "sources_considered": ["uuid"]
}
```

### 6.2 `ScoreSchema` (prospector-score, déterministe)
```jsonc
{
  "total": 87,
  "label": "Très intéressant",
  "priority": "hot",
  "breakdown": {
    "fit_tada_wind": 22, "video_interest": 18, "drone_interest": 13,
    "commercial_potential": 12, "digital_gap": 8,
    "geo_access": 4, "buying_signal": 5, "contactability": 5
  },
  "reasons": ["hôtel haut de gamme", "environnement très photogénique",
              "Instagram actif", "aucune vidéo drone récente",
              "Reels peu professionnels", "situé à 32 km",
              "email de direction disponible"],
  "weights_version": "2026-09-05"
}
```

### 6.3 `StrategySchema` (prospector-strategize)
```jsonc
{
  "angles": [
    { "title": "Vidéo de présentation globale", "rationale": "string",
      "tada_wind_services": ["vidéo promotionnelle", "drone"],
      "estimated_value_eur": [800, 1500] }
  ],                                    // 1 à 3
  "primary_angle_index": 0,
  "recommended_channel": "email | instagram_dm | linkedin | phone",
  "objections": [{ "objection": "string", "response": "string" }],
  "arguments": ["string"]
}
```

### 6.4 `MessageSchema` (prospector-copywrite)
```jsonc
{
  "variants": {
    "email":        { "subject": "string", "body": "string" },
    "instagram_dm": { "body": "string" },
    "linkedin":     { "body": "string" },
    "phone_script": { "opening": "string", "reason": "string",
                      "proposal": "string", "objections": [{...}], "cta": "string" }
  },
  "sources_used": [
    { "source_id": "uuid", "url": "string", "claim": "phrase du message qui s'appuie dessus" }
  ],
  "tone_check": { "generic": false, "fake_compliment": false, "corporate": false },
  "confidence": 0.0
}
```
**Règle P2 appliquée** : le validateur serveur rejette le message si une phrase « personnalisée » (mention d'un contenu, d'une page, d'un post) n'a pas d'entrée correspondante dans `sources_used`.

---

## 7. Pipeline de traitement d'un prospect

```
[Campagne créée] ──► job discovery
   └─► Overpass (POI par catégorie+bbox) ──► géocode manquants ──► normalise ──► DEDUPE
        ├─ existant ► enrich fiche + event(enriched)
        └─ nouveau  ► insert prospect(status=new) + source(osm) + event(discovered)
                         └─► job enrich
   job enrich ──► fetch website (cache) + parse + détecte réseaux + signaux ──► prospect_sources
                    └─► pré-filtre : distance ≤ radius_max ? catégorie activée ? pas blacklist ?
                          ├─ non ► status=excluded + event(excluded, raison)
                          └─ oui ► job analyze
   job analyze  ──► LLM(Sonnet) AnalysisSchema (faits only) ──► prospect.analysis
                    └─► job score
   job score    ──► barème §8 ──► prospect.score/priority/breakdown/reasons ──► event(scored)
                    └─► si priority ∈ {hot,good,consider} ► job strategize ; sinon status=low_priority
   job strategize ─► LLM StrategySchema ──► prospect.strategy
                    └─► job copywrite
   job copywrite ─► LLM MessageSchema ──► prospect_messages(kind=first_touch, status=draft)
                    └─► prospect.status = to_validate + event(message_generated)
[File "À valider"] ──► action utilisateur : approve / edit / regenerate / later / reject / blacklist
```

---

## 8. Modèle de scoring (/100, transparent)

Barème V1 (stocké dans `prospector_settings.scoring_weights`, `weights_version`) :

| Critère | Max | Source |
|---|---|---|
| Adéquation avec Tada Wind (`fit_tada_wind`) | 25 | `analysis.qualitative_scores.fit_tada_wind` ↦ ×0.25 |
| Intérêt prestation vidéo | 20 | `qualitative_scores.video_need` ×0.20 |
| Intérêt prestation drone | 15 | `qualitative_scores.drone_need` ×0.15 |
| Potentiel commercial | 15 | `qualitative_scores.commercial_potential` ×0.15 |
| Présence numérique perfectible | 10 | `qualitative_scores.digital_gap` ×0.10 |
| Accessibilité géographique | 5 | distance : ≤30 km→5, ≤60→3, ≤100→1, >100→0 |
| Signal d'achat récent | 5 | `buying_signals` : fort→5, moyen→3, faible→1, aucun→0 |
| Facilité de contact | 5 | email direct→5, email général→3, formulaire seul→1, rien→0 |
| **Total** | **100** | |

Seuils priorité (configurables, `priority_thresholds`) :

| Priorité | Score | Badge |
|---|---|---|
| 🔥 Très chaud (`hot`) | ≥ 80 | rouge |
| 🟢 Bon prospect (`good`) | 60–79 | vert |
| 🟡 À considérer (`consider`) | 40–59 | ambre |
| ⚪ Faible priorité (`low`) | 20–39 | gris |
| 🔴 À exclure (`excluded`) | < 20 ou règle d'exclusion | rouge sombre |

Affichage obligatoire : `Score : 87/100 — Très intéressant` **+** liste `reasons` juste en dessous.

Exclusions dures (avant scoring) : entreprise fermée, hors zone `radius_max`, catégorie désactivée, déjà cliente (`is_client`), présente dans `prospect_blacklist`, doublon.

---

## 9. Génération de message — règles

- **Interdits** : ouverture générique (« Bonjour, je suis vidéaste et je propose mes services »), faux compliments, phrases vides, ton corporate/robotique, superlatifs non étayés.
- **Structure cible** : (1) accroche liée à leur activité — étayée par une source ; (2) élément précis observé — source ; (3) opportunité détectée ; (4) proposition concrète (1 angle) ; (5) CTA simple.
- **Variantes** : email (développé, pro), Instagram DM (court, direct), LinkedIn (pro conversationnel), script téléphone (ouverture / raison / proposition / objections / CTA).
- **Ton** : naturel, humain, direct, sympathique, sobre.
- **Anti-hallucination** : le copywriter ne reçoit **que** `prospect_sources` + `analysis` + `strategy` + `business_profile`. Pas d'accès web. Chaque assertion « j'ai vu … » doit être dans `sources_used`. Validateur serveur = garde-fou (P2/P3).

---

## 10. UX par écran

### 10.1 Dashboard Prospection
Cartes chiffrées : trouvés aujourd'hui · analysés · qualifiés · à valider · contactés · réponses · réponses positives · RDV · opportunités ouvertes · taux de réponse · taux de conversion · score moyen · prochaines relances · meilleurs secteurs · meilleurs canaux.
Bloc **« Ce que je dois faire maintenant »** (calqué sur `leadViews.js`) : `X prospects à valider` · `Y réponses à traiter` · `Z relances recommandées` · `W opportunités chaudes` — chaque ligne cliquable vers la vue filtrée.

### 10.2 Recherche / Campagne
Formulaire critères : secteur/catégorie, activité, localisation (ville / département / région), **rayon** (préféré/max), taille, standing, présence web / réseaux / vidéo, qualité apparente, type de clientèle, saisonnalité, mots-clés. Bouton **« Lancer la campagne »** → crée `prospect_campaigns` + job `discovery`. Affiche l'avancement des jobs.

### 10.3 Prospects (datatable — calquée sur `LeadsList.jsx`)
Colonnes : score · nom · activité · ville · distance · statut · opportunité · dernier contact · prochaine action · canal · date découverte.
Fonctions : recherche, tri, filtres (score min, catégorie, statut, ville, distance, canal dispo, email dispo, Instagram dispo, vidéo absente, drone absent, priorité, date, campagne, tag), pagination, sélection multiple, actions batch, filtres sauvegardables (`localStorage`).

### 10.4 Fiche prospect (onglets)
`Résumé` (identité + score + raisons + prochaine action) · `Analyse` (AnalysisSchema lisible) · `Présence numérique` (site + réseaux + captures/liens + `last_verified_at` + bouton « Réanalyser ») · `Opportunités` (angles + prestations + valeur estimée ; bouton « Créer une opportunité ») · `Messages` (variantes, éditables, régénérables, section « Sources utilisées ») · `Historique` (timeline `prospect_events`) · `Notes` (texte libre) · bloc `Tags`.

### 10.5 File « À valider » + mode batch
Carte par prospect : nom · activité · distance · score · raison principale · canal recommandé · message généré (aperçu).
Actions : ✅ Valider · ✏️ Modifier · 🔄 Régénérer · ⏭️ Plus tard · ❌ Refuser (+ raison §49) · 🚫 Blacklist.
Mode batch : navigation clavier entre cartes, validation rapide, objectif « session quotidienne en quelques minutes ».

### 10.6 Réglages Prospection
Profil Tada Wind (`business_profile`), zone & rayons, score minimum, seuils priorité, bandes de distance, catégories activées/désactivées, délais de relance, modèle IA + ton, canaux, **barème de scoring** (édition + version). Écrit dans `prospector_settings`.

---

## 11. Pipeline CRM & statuts

`prospects.status` : `new → to_analyze → qualified → to_validate → ready_to_contact → contacted → followup_1 → followup_2 → replied → interested → meeting → quote → won → lost → archived`.
Statuts adaptables (liste en config). Chaque changement → `prospect_events(type='status_changed')`.
`excluded` / `low_priority` = états terminaux « de côté » (réactivables).

Opportunités (Phase 1 light, table dédiée en Phase 2) : prestation potentielle, valeur estimée, probabilité, prochaine action, RDV, devis, notes.

---

## 12. Phases 2 & 3 (résumé — hors périmètre V1)

**Phase 2** : campagnes complètes + stats ; relances auto J+3/J+7/J+14 (non agressives, stoppées si réponse négative) ; dashboard analytique ; affinage scoring via `prospect_feedback` ; enrichissement réseaux plus poussé ; import/export CSV ; système de tags/notes avancé.

**Phase 3** : connecteurs email/messagerie ; classification des réponses (`positif|intéressé|infos|tarif|pas maintenant|négatif|unsubscribe|auto`) → **réponse préparée, jamais envoyée auto en V1** ; mémoire des préférences **visible et explicable** (jamais de modif silencieuse des règles majeures) ; agents autonomes supplémentaires ; éventuelles automatisations post-échange engagé.

---

## 13. Gestion des erreurs & observabilité

- Retry (max 3, backoff), timeout par job, tolérance aux données partielles (un prospect à moitié enrichi reste exploitable).
- Une source qui tombe ne fait **pas** échouer la campagne.
- Erreurs typées : `SOURCE_UNREACHABLE`, `RATE_LIMITED`, `LLM_INVALID_OUTPUT`, `TIMEOUT`, `NO_WEBSITE`, `PARSE_FAILED`.
- Logs (console Edge + table `prospect_events` / `prospect_jobs.error`) : campagne démarrée, prospect trouvé, prospect dédupliqué, enrichissement terminé, scoring terminé, erreur source, génération terminée. **Jamais de secret loggé.**

---

## 14. Coûts IA

- `ai_usage` : 1 ligne par appel LLM (fonction, modèle, tokens in/out, coût estimé, prospect/campagne).
- Analyse progressive : pas d'appel Sonnet si le pré-filtre (distance/catégorie/blacklist) échoue.
- Cache fetch web par `url` (table ou KV) avec TTL (ex. 14 j).
- Haiku : `crm-next`, résumés courts. Sonnet : `analyze`, `strategize`, `copywrite`.
- Dashboard Réglages : coût estimé par campagne / par prospect.

---

## 15. Tests

Runner unitaire à ajouter : **Vitest** (léger, intégré Vite) — dev-dépendance uniquement.

| Cible | Tests |
|---|---|
| `scoring.js` | barème borné 0–100, mapping priorité, distance bands, signal weights, reasons non vides |
| `dedupe.js` | normalisation nom (formes juridiques, accents), domaine (`www`, chemin), téléphone E.164 ; match domaine / téléphone / nom+ville ; non-match |
| Statuts CRM | transitions autorisées, `first_touch` ne peut pas sauter à `sent` sans action user |
| Création prospect | insert + `dedupe_hash` + event `discovered` |
| Validation schémas IA | `AnalysisSchema`/`ScoreSchema`/`StrategySchema`/`MessageSchema` : accept valides, reject invalides, reject message sans `sources_used` cohérent |
| Enrichment parsing | extraction titre/meta/embeds vidéo/liens réseaux sur HTML fixtures |
| Erreurs | `SOURCE_UNREACHABLE`, `LLM_INVALID_OUTPUT` → job `error` propre, campagne continue |
| e2e Playwright | nav Prospection, création campagne (jobs mockés), ouverture fiche, validation d'un message |

---

## 16. Découpage en lots (Phase 1)

> Chaque lot = livrable testable, PR séparée. Ordre = dépendances.

| Lot | Contenu | Dépend de |
|---|---|---|
| **L0** | `docs/prospector/schema.sql` finalisé + migration appliquée (tables + RLS + index dédup) + `prospector_settings` seed | — |
| **L1** | Nav : entrée Sidebar `Prospection`, `ProspectorApp.jsx` + sous-nav, écrans vides + routing interne | L0 |
| **L2** | `useProspectorSettings` + écran **Réglages Prospection** (profil Tada Wind, rayons, seuils, barème) | L1 |
| **L3** | `src/lib/prospector/dedupe.js` + `scoring.js` + tests Vitest (setup Vitest inclus) | L0 |
| **L4** | `prospects` CRUD : `useProspects`, **datatable** `ProspectsTable` (filtres/tri/pagination/batch), ajout manuel | L1, L3 |
| **L5** | Fiche prospect `ProspectDetail` (onglets), timeline `prospect_events`, notes, tags | L4 |
| **L6** | Edge `prospector-worker` + table `prospect_jobs` + `useProspectorJobs` + `pg_cron` (ou GH Action) + UI avancement | L0 |
| **L7** | Edge `prospector-enrich` (fetch site, parse, sources, signaux) + tests parsing | L6 |
| **L8** | Edge `prospector-analyze` + `AnalysisSchema` (Zod) + `ai_usage` — **nécessite `ANTHROPIC_API_KEY`** ⚠️ | L7 |
| **L9** | Edge `prospector-score` (déterministe, réutilise barème L3) → `ScoreSchema` | L8 |
| **L10** | Edge `prospector-strategize` + `prospector-copywrite` + `Strategy/MessageSchema` + garde-fou anti-hallucination | L9 |
| **L11** | Edge `prospector-discovery` (Overpass + Nominatim) + `SearchCampaign.jsx` + `prospect_campaigns` | L6, L3 |
| **L12** | `prospector-manual-analyze` (enchaînement) branché sur le bouton « Analyser ce prospect » | L7–L10 |
| **L13** | File **« À valider »** + mode batch + actions (approve/edit/regenerate/later/reject/blacklist) + `prospect_feedback` | L5, L10 |
| **L14** | **Dashboard Prospection** + « Ce que je dois faire maintenant » | L4, L13 |
| **L15** | Doc finale `docs/prospector/README.md` (§59 mission) + scénario d'acceptation vérifié | tous |

**Critère d'acceptation V1** (scénario mission §56) : créer une campagne « Hôtels dans 50 km » → entreprises réelles, sans doublon, enrichies, analysées, scorées → meilleurs prospects visibles → ouvrir une fiche → comprendre le score → voir prestations + message perso → éditer/régénérer → valider → passage CRM + historique complet.

---

## 17. Répartition suggérée du travail (Claude Code ⇄ ChatGPT « Astra »)

> À ajuster selon vos préférences. Découpage pensé pour minimiser les conflits de fichiers.

| Bloc | Suggéré | Raison |
|---|---|---|
| L0 schema.sql + migration Supabase | **Claude Code** (accès MCP Supabase direct) | applique et vérifie RLS/advisors |
| L3 `dedupe.js` / `scoring.js` + Vitest | **Astra** | logique pure, très spécifiable, testable en isolation |
| L1–L2, L4–L5, L13–L14 (front React) | **Claude Code** | doit coller au design system inline existant, patterns `LeadsList`/`LeadDetail` |
| L6–L12 (Edge Functions Deno/TS + schémas Zod + prompts LLM) | **partagé** : Astra rédige prompts + schémas + logique parsing ; Claude Code intègre, déploie (MCP `deploy_edge_function`), teste end-to-end | |
| Prompts LLM (analyze/strategize/copywrite) + garde-fous anti-hallucination | **Astra** (itération prompt) → revue Claude Code | |
| Tests e2e Playwright | **Claude Code** | infra Playwright déjà là |
| Doc finale | **partagé** | |

**Interface de contrat entre les deux** : ce document (§5 schema, §6 schémas IA, §8 barème) + `docs/prospector/schema.sql`. Toute évolution d'un schéma = mise à jour ici **d'abord**.

---

## 18. Décisions ouvertes (⚠️ Tarik)

| # | Décision | Options | Reco |
|---|---|---|---|
| D1 | **Clé LLM** | (a) Anthropic `ANTHROPIC_API_KEY` maintenant · (b) commencer sans (L0–L7, L11 faisables) et brancher après · (c) OpenAI | (a) ou (b). Sans clé, tout le bloc analyse/score/message (L8–L10, L12–L14) est en attente |
| D2 | **Source de découverte V1** | (a) Overpass/OSM gratuit · (b) Google Places payant · (c) SIRENE + web | (a) pour la V1, (b) en upgrade V2 |
| D3 | **Adresse de référence & rayons** | — | à saisir dans Réglages (défaut proposé : Sarlat-la-Canéda, préféré 40 km, max 100 km) |
| D4 | **Déclencheur du worker** | (a) `pg_cron` dans Supabase · (b) GitHub Actions (pattern keepalive) | (a) si dispo sur le plan, sinon (b) |
| D5 | **Runner de tests unitaires** | Vitest | Vitest (dev-dep, n'impacte pas le build) |
| D6 | **Périmètre réseaux sociaux V1** | lecture best-effort des liens/pages publiques uniquement (pas d'API Instagram, pas de scraping agressif) | oui (RGPD/ToS) |
| D7 | **Budget IA mensuel cible** | — | fixe le choix Haiku/Sonnet et le plafond d'alerte `ai_usage` |

---

## 19. Récapitulatif variables & secrets

**Build front (GitHub Secrets — déjà présents)** : `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
**Edge Functions (Supabase → Secrets — à créer)** : `ANTHROPIC_API_KEY` ⚠️, `PROSPECTOR_CRON_SECRET`, `NOMINATIM_USER_AGENT`, (`GOOGLE_MAPS_API_KEY` en V2). `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` sont fournis automatiquement dans l'environnement des Edge Functions.

---

## 20. Rappels de conformité au brief

- ✅ Pas de faux MVP : pas de bouton mort, pas de faux prospects, pas de faux appels API. Les mocks (ex. jobs en L1) sont temporaires et étiquetés.
- ✅ Human-in-the-loop strict avant 1er contact (P1).
- ✅ Anti-hallucination avec traçabilité des sources (P2).
- ✅ Sorties structurées validées serveur (P3).
- ✅ Secrets hors front (P4).
- ✅ Intégration propre, rien de cassé (P7).
- ✅ Scoring transparent et justifié (P8, §8).

---

*Rédigé le 2026-09-05 après inspection complète du repo `TadaWind-admin` (branche `claude/tada-wind-prospector-8f84b7`).*

## 21. Précisions de contrat pour l'implémentation Astra (2026-09-05)

Ces précisions complètent les exemples des §5–8 avant leur implémentation.

- **Déduplication** : valeurs absentes ou invalides → `null`, jamais de match entre valeurs vides. Téléphones français métropolitains sur 10 chiffres, `+33`, `0033` et notation `+33 (0)` ; autres numéros internationaux conservés si forme E.164 valide. Pas de correspondance automatique sur l'email seul. `dedupe_hash` = clé textuelle déterministe préfixée (domaine, téléphone, ou tuple JSON nom+ville), pas un identifiant de sécurité ni une garantie d'unicité. Recherche sur tous les signaux, même si les clés principales diffèrent. Plusieurs correspondances → conflit à résoudre, pas de fusion automatique. Les lignes supprimées sont ignorées ; la blacklist reste à consulter séparément. Le SQL de normalisation doit être aligné sur la fonction JS avant L0 (formes juridiques ponctuées, ligatures, espaces).
- **Scoring** : `scoreProspect({ prospect, analysis, settings, context })` renvoie le `ScoreSchema`. `context` serveur porte `distance_km`, `is_closed`, `is_blacklisted`, `is_duplicate` et `has_contact_form`. Une distance inconnue ne vaut jamais zéro km ; elle ne rapporte aucun point. `contact_email` valide = contact direct ; `email`/`email_commercial` valides = général ; aucun classement direct déduit du seul nom de boîte mail. Signal d'achat = maximum, sans cumul. Qualitatifs absents/non numériques = 0 ; numériques bornés 0–100. Chaque contribution est arrondie à 2 décimales, total entier arrondi de leur somme. Configuration invalide → erreur explicite ; les huit poids doivent totaliser 100. Les trois `distance_bands` ordonnées portent des maxima croissants et utilisent 5/3/1 points de base (ou un champ `points` explicite 0–5). Poids personnalisé = proportion de ces points. Exclusion dure → score 0 et ventilation nulle, motif explicite. Le label `hot` est « Très intéressant ». Les motifs décrivent les entrées et les calculs, sans inventer d'observations commerciales. L'exemple §6.2 est illustratif : 32 km donne 3 points géographiques, pas 4.
- **Analyse** : `visual_dependency` accepte aussi `inconnu`. Aucun constat d'absence globale de vidéo/drone/activité sociale à partir d'une seule page sans détection. `sources_considered` non vide ; chaque signal d'achat référence une source considérée appartenant au prospect courant. Les sources sont rechargées côté serveur, jamais acceptées comme preuves depuis la réponse LLM.
- **Stratégie** : `estimated_value_eur` accepte `null` si le profil TW ne fournit aucun tarif de référence. Les montants restent des estimations internes, pas des devis. Index d'angle existant, 1–3 angles, services appartenant au profil TW et canal réellement disponible.
- **Messages** : `sources_used` devient `{source_id, type, url, claim, path, evidence_quote}[]`. `path` désigne un champ texte de `variants` (ex. `email.body`, `phone_script.objections.0.response`). `claim` est un extrait exact de ce champ ; `evidence_quote` un extrait exact de la source serveur. `url` peut être `null` pour une source manuelle. Ajout obligatoire de `grounding: [{path, text, kind, source_ids}]` où `kind` = `fact|proposal|generic` et les segments recouvrent exactement chaque champ texte, dans l'ordre. Chaque segment factuel exige des citations cohérentes. Chaque variante contient au moins un fait sourcé. Ce contrôle assure la traçabilité et la couverture déclarée, **pas l'implication sémantique** : un LLM peut mal classer un fait comme proposition ou citer un extrait non probant. La validation humaine demeure indispensable ; ne jamais afficher « zéro hallucination garanti » ni considérer la seule réussite Zod comme une approbation.
- **Parsing HTML** : extraction sans réseau, sans exécution JS ; produit observations locales, liens et extrait textuel. L'absence d'embed n'établit pas l'absence de vidéo dans l'entreprise. Aucun jugement automatique sur la qualité des images ni date de dernière activité inventée. Les IDs de sources sont attribués à l'insertion par le backend, pas par le parseur.

### 21.1 Risques à traiter dans les lots d'intégration Claude

1. Le SQL brouillon autorise actuellement tout `authenticated` à modifier messages et jobs. Il faut des transitions protégées côté base/RPC, liées à l'identité authentifiée ; le champ `actor=user` seul n'est pas une preuve. Une modification après approbation doit invalider l'approbation. Les bibliothèques Astra n'appliquent pas ces protections en base.
2. La contrainte unique de domaine peut confondre plusieurs établissements d'un même groupe. Les collisions doivent être visibles ; ne pas écraser un établissement automatiquement. Téléphone/nom+ville n'ont pas de contrainte unique : l'insertion concurrente doit être sérialisée côté base.
3. Claim atomique des jobs via RPC transactionnelle avec bail/reprise des jobs `running`, idempotence des étapes et contrôle des types de jobs ; un simple SELECT suivi d'UPDATE ne suffit pas.
4. Fetch serveur : protection SSRF sur URL initiale et redirections/résolution DNS, timeout, taille limitée, MIME HTML, cadence et cache. Le parseur ne fournit pas la couche fetch.
5. Le SQL ne stocke pas encore distance et version du score par prospect, et le singleton/settings manque de contraintes. Conserver le résultat complet du scorer dans l'événement `scored` jusqu'à finalisation L0. Définir budget IA, quotas et vérifier les identifiants de modèles avant déploiement.

## 22. Contrat du socle L0 (implémentation du 2026-09-05)

Ce lot remplace le SQL brouillon avant application. La migration versionnée est la référence exécutable ; `schema.sql` en est une copie vérifiée.

- Lecture des dix nouvelles tables pour `authenticated`, aucun accès `anon`. Écritures du navigateur via RPC ciblées, jamais de DML direct sur messages, sources, événements, jobs, coûts ou analyses. Authentification existante conservée : les comptes authentifiés de cet admin partagent le module.
- `prospector_save_settings(p_settings,p_expected_updated_at)` valide les réglages et refuse d'écraser une modification concurrente. Les modèles et le budget IA sont initialement non configurés ; aucun identifiant de modèle supposé valide n'est enregistré par défaut.
- `prospector_create_prospect(p_input)` prend l'identité et les contacts publics, sérialise l'ajout, normalise en SQL et rejette les collisions avec leur motif. Aucun merge automatique. Pour un domaine international, le client transmet une URL canonique (hostname ASCII/Punycode via `new URL`). Le SQL rejette une URL non canonique plutôt que normaliser différemment. Ajout de `normalized_city`, `distance_km`, `weights_version` sur `prospects`.
- Messages : ajout de `revision`, `validated_revision`, `validated_source_hash`, `approved_by`, `sent_by` et `updated_at`. Le backend valide Zod + preuves sur le contexte fourni par `prospector_message_context`, puis appelle `prospector_validate_message` avec la révision et l'empreinte des sources lues. Toute modification du contenu invalide cette validation et l'approbation ; une source modifiée invalide l'empreinte lors de la prochaine approbation/confirmation.
- `prospector_review_message` autorise `approve`, `edit`, `reject`, `later` avec révision attendue. `prospector_confirm_message_sent` est une action utilisateur séparée : elle **constate un envoi manuel**, sans connecteur d'envoi. Aucune fonction du lot n'envoie un message. Une session `service_role` ne peut approuver ou confirmer l'envoi. Un message marqué envoyé devient immuable.
- `prospector_blacklist_prospect` mémorise les identifiants d'opposition, exclut le prospect, rejette les brouillons/approuvés et annule les jobs actifs. Les vérifications sont répétées à l'approbation, à la confirmation d'envoi et à la réservation des jobs. `prospector_delete_prospect` supprime prospect et enfants ; la liste d'opposition indépendante est conservée.
- Jobs : `claim_token`, `lease_until`, `idempotency_key`. `prospector_enqueue_job` est réservé au backend, clé d'idempotence obligatoire ; `prospector_request_analysis` autorise l'utilisateur à demander une analyse manuelle, sans doublonner un job actif. `prospector_claim_jobs` (backend) prend au plus 5 jobs par transaction avec `SKIP LOCKED`, incrémente les tentatives et attribue un bail. `prospector_finish_job` refuse une réponse de worker périmée et applique un backoff borné par `max_attempts`. Les jobs abandonnés sont remis en queue ou terminés en erreur après épuisement des tentatives. Le worker effectif reste L6.
- Validation locale du SQL sur PostgreSQL réel : appliquer migration + tests dans une transaction, puis `ROLLBACK`. Les fixtures ne sont pas conservées. Migration appliquée uniquement après réussite ; contrôle des droits/RLS et empreinte du schéma historique ensuite.
