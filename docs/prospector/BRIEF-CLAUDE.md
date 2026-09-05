# Brief à copier pour Claude Code (session d'implémentation)

> Ouvre Claude Code **dans le repo `TadaWind-admin`** (branche dédiée, ex. `claude/tada-wind-prospector`) et colle ce bloc.

---

Tu implémentes le module **Tada Wind Prospector** dans cette app (TadaWind-admin).

**Avant de coder**, lis `docs/prospector/PLAN-ACTION.md` en entier, puis `docs/prospector/schema.sql`. C'est la spec qui fait foi (architecture, modèle de données, contrats de sorties IA, barème de scoring §8, découpage en lots L0→L15, §17 répartition du travail). `docs/prospector/BRIEF-ASTRA.md` décrit ce qu'un second agent (ChatGPT Astra) produit en parallèle : `src/lib/prospector/scoring.js` + `dedupe.js` + leurs tests, les prompts LLM et schémas Zod des Edge Functions d'analyse. Ne réécris pas ces fichiers-là s'ils arrivent ; sinon, pose des stubs conformes aux contrats du plan et signale-le.

**Contraintes non négociables** (détail §3 du plan) :
1. Aucun premier message commercial envoyé sans validation humaine explicite (statut `draft → approved → sent`, `sent` seulement sur action utilisateur).
2. Zéro hallucination : chaque phrase personnalisée d'un message référence une `prospect_source` réelle ; garde-fou de validation côté serveur.
3. Sorties IA structurées validées par schéma (Zod) dans les Edge Functions ; jamais de sortie brute persistée.
4. Secrets (clé LLM, cron secret) uniquement dans les secrets Supabase Edge Functions, jamais dans le front (`VITE_*` est public).
5. Ne rien casser : pas de modif des tables `projects`/`leads`, pas d'ajout de react-router, coller au design system inline + tokens `globals.css`, réutiliser les patterns de `LeadsList.jsx` / `LeadDetail.jsx`.

**Ton périmètre (§17 du plan)** :
- **L0** : finalise `docs/prospector/schema.sql` et applique la migration via le MCP Supabase ; vérifie RLS + advisors ; seed `prospector_settings`.
- **L1–L2** : entrée Sidebar `Prospection`, `src/components/prospector/ProspectorApp.jsx` + sous-navigation interne (pas de routeur), écran **Réglages Prospection** + `useProspectorSettings`.
- **L4–L5** : `useProspects`, datatable `ProspectsTable` (calquée sur `LeadsList`), ajout manuel, fiche `ProspectDetail` en onglets + timeline `prospect_events`.
- **L6–L12** : table `prospect_jobs` + Edge Function `prospector-worker` (+ pg_cron ou GitHub Actions), puis intégration/déploiement des Edge Functions `prospector-enrich / -analyze / -score / -strategize / -copywrite / -discovery / -manual-analyze` (MCP `deploy_edge_function`), en branchant les prompts/schémas fournis par Astra.
- **L13–L14** : file « À valider » + mode batch + actions, Dashboard Prospection + bloc « Ce que je dois faire maintenant ».
- **L15** : `docs/prospector/README.md` + vérification du scénario d'acceptation (§16 / mission §56).
- Tests : mets en place **Vitest** (dev-dep) ; tests e2e Playwright pour la nav Prospection et la validation d'un message.

**Décisions Tarik en attente (§18 du plan)** — commence par ce qui n'est pas bloqué :
- `ANTHROPIC_API_KEY` : si absente, fais L0, L1–L6, L7, L11 (discovery + enrich, sans LLM) et pose un adaptateur LLM propre + mode dégradé étiqueté pour L8–L10, L12–L14.
- Découverte : pars sur **OpenStreetMap / Overpass** (gratuit) pour la V1.
- Adresse de référence + rayons : défaut Sarlat-la-Canéda, 40 / 100 km, modifiable dans Réglages.
- Worker : `pg_cron` si dispo, sinon workflow GitHub Actions (pattern `supabase-keepalive.yml`).

**Méthode** : un lot = une PR testable. Après chaque lot : implémente → teste → vérifie l'intégration (rien de cassé côté `projects`/`leads`) → lot suivant. Ne fais pas un gros refactor. Commence maintenant par L0 et enchaîne ; ne t'arrête pas à une proposition théorique.
