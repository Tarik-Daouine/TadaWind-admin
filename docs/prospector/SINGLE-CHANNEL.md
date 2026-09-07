# Rédaction par canal — 6 septembre 2026

La rédaction génère le canal recommandé par la stratégie. Les autres canaux se demandent individuellement depuis la file de validation, uniquement si les réglages et les coordonnées le permettent.

## Contrat et garde-fous

- Une seule variante, au plus 2 400 caractères, 24 segments et 8 citations.
- Chaque segment factuel contient directement ses preuves (`source_id`, `evidence_quote`). Le serveur reconstruit `source_ids`, `sources_used`, les chemins, les affirmations, les URL et les types depuis les segments et les sources qu'il a chargées. Le modèle n'a plus à répéter ces métadonnées.
- Le validateur existant contrôle toujours la couverture exacte de chaque champ, les identifiants, les extraits littéraux et la présence d'un fait sourcé. La vérité et la pertinence sémantique restent à vérifier par l'humain.
- Le stockage remplace uniquement le brouillon du canal demandé. Les autres canaux et le travail humain (approbation ou révision > 1) restent protégés. Un premier contact envoyé bloque toute nouvelle génération de premier contact.
- La protection est vérifiée à la mise en file, avant l'appel payant et à nouveau au stockage sous verrou.
- Les diagnostics de validation contiennent un code technique et l'identifiant du prospect, sans réponse brute. La correction du JSON reste limitée à une tentative supplémentaire.

## Diagnostic du modèle

Sonnet 5 active son raisonnement adaptatif par défaut. Son plafond de sortie couvre ce raisonnement et le texte. Les anciens échecs à 16 000 tokens ne mesuraient donc pas nécessairement un JSON de 16 000 tokens. Voir [le guide de migration Anthropic](https://platform.claude.com/docs/en/models/sonnet-5/migration-guide).

La rédaction désactive explicitement ce raisonnement supplémentaire, garde 4 096 tokens maximum et un timeout de 60 secondes par appel. Les réglages d'analyse et de stratégie sont conservés. Le worker garde une fenêtre de démarrage de 20 secondes et un bail de 240 secondes.

Le premier essai à un canal avec le raisonnement par défaut a tronqué à 4 096 tokens (0,0519 $). Sans ce raisonnement, les premières réponses faisaient environ 1 000 tokens, mais leur double saisie des citations ne respectait pas le contrat. Le format final imbrique les preuves dans les segments pour supprimer ces renvois fragiles.

## Validation et déploiement

- 156 tests unitaires passent.
- Tests SQL de suivi/budget et de protection par canal passent dans un schéma isolé, avec annulation de la transaction.
- Six scénarios navigateur distincts passent, dont la demande d'un DM en conservant un email approuvé. Le test nécessitant une session locale enregistrée est ignoré. Les appels REST des scénarios de prospection sont simulés.
- Compilation Vite et vérification Deno réussies. Avertissement préexistant sur la taille du bundle.
- Migration `20260906180000` appliquée à Supabase ; worker version 17 déployé. L'interface doit encore être intégrée sur `main` pour sa publication.
- Essais réels limités au même prospect, avec `max_attempts=1` par job. Les dix anciens jobs de rédaction restent arrêtés. Aucun message n'est envoyé par ces essais.
- Les anciennes réservations incertaines ne sont pas remboursées automatiquement : un timeout ne prouve pas l'absence de facturation. Le plafond reste 10 €/mois.

Commandes : `npm test`, `node scripts/prospector-release-check.mjs`, `node scripts/prospector-release-check.mjs single-channel`, `npx playwright test`, `npx deno check --no-lock --config supabase/functions/prospector-worker/deno.json supabase/functions/prospector-worker/index.ts`.

La suite est la revue du premier brouillon réel, la publication de l'interface, puis une reprise progressive des jobs arrêtés après contrôle de la qualité et des coûts.

Le premier stockage réel a réussi pour Le Petit Manoir, mais une citation ne justifiait pas le constat d’absence de vidéo. La consigne a été renforcée : un fait positif explicite par segment, aucune affirmation d’absence de vidéo ou de manque de communication. Le validateur garantit la traçabilité structurelle, pas la vérité sémantique ; la revue humaine reste indispensable.

## Résultat du dernier essai réel

Le Petit Manoir : job terminé, un email stocké en brouillon, révision 1 et traçabilité validée. Dernier appel : 850 tokens de sortie, coût estimé 0,0198 $. Le constat non justifié d’absence de vidéo a disparu. La citation du corps couvre la tour historique, mais pas à elle seule toutes les caractéristiques énumérées : la qualité des citations et la formulation restent à relire avant approbation.

À la clôture : file vide, cumul enregistré 1,0697 $, engagement 1,457423 € sur 10 €, dont 0,38757 € de réservations anciennes non réglées. Aucun envoi, aucune approbation automatique, aucune reprise globale des dix jobs arrêtés.
