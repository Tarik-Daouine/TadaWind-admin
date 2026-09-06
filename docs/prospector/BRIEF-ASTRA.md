# Brief à copier pour ChatGPT « Astra »

> Colle ce bloc à Astra. Joins-y `PLAN-ACTION.md` et `schema.sql` (même dossier).

---

Tu interviens sur **TadaWind-admin**, une app React 18 + Vite (JavaScript, pas TypeScript), 100 % statique déployée sur GitHub Pages, backend = **Supabase uniquement** (Postgres + Auth + Edge Functions Deno). On ajoute un module **Tada Wind Prospector** : un assistant commercial IA semi-autonome (recherche d'entreprises → enrichissement → analyse → scoring → message personnalisé → validation humaine → CRM).

La spécification complète est dans `PLAN-ACTION.md` (architecture, modèle de données, contrats de sorties IA, barème de scoring, découpage en lots L0–L15). Le schéma SQL est dans `schema.sql`. **Ces deux fichiers font foi.** Toute évolution d'un schéma se fait dans `PLAN-ACTION.md` d'abord.

**Contraintes non négociables :**
1. Aucun premier message commercial n'est envoyé sans validation humaine explicite.
2. Zéro hallucination : chaque phrase personnalisée d'un message doit référencer une source réelle (`prospect_sources`). Le copywriter n'a pas accès au web, seulement aux faits extraits.
3. Sorties IA structurées, validées par schéma (Zod) côté Edge Function. Jamais de sortie brute persistée.
4. Secrets (clé LLM…) uniquement dans les secrets Supabase, jamais dans le front.
5. Ne rien casser : pas de modif des tables `projects`/`leads`, pas de react-router, coller au design system inline existant.

**Ton périmètre prioritaire (voir §17 du plan) :**
- `src/lib/prospector/dedupe.js` et `scoring.js` + tests Vitest — logique pure, spécifiée en §5.3 et §8.
- Rédaction des **prompts LLM** et des **schémas Zod** pour les Edge Functions `prospector-analyze`, `-strategize`, `-copywrite`, `-score` (contrats en §6), avec les garde-fous anti-hallucination.
- Logique de parsing de `prospector-enrich` (extraction titre/meta/embeds vidéo/liens réseaux/signaux depuis le HTML d'un site).

Claude Code s'occupe de : migration SQL + RLS (accès MCP Supabase), tous les écrans React, l'intégration/déploiement des Edge Functions, les tests e2e Playwright.

**Décisions en attente de Tarik (⚠️ §18 du plan)** : clé LLM (Anthropic recommandé), source de découverte (OpenStreetMap/Overpass gratuit pour la V1), adresse de référence + rayons, budget IA mensuel.

Commence par : (a) me dire si le modèle de données ou les contrats IA te semblent incomplets/risqués, (b) livrer `scoring.js` + `dedupe.js` avec leurs tests, (c) proposer les prompts + schémas Zod pour `prospector-analyze`.
