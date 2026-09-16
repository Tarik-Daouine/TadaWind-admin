# Envoi Outlook personnel (Microsoft Graph)

La boîte d’envoi est `Tada-Wind@outlook.com`, un compte Microsoft personnel. L’admin utilise donc un consentement utilisateur délégué `Mail.Send`, puis `/me/sendMail`. L’ancien flux `client_credentials`, prévu pour une organisation Microsoft 365, n’est plus utilisé.

Une licence Microsoft 365 n’est pas nécessaire. Microsoft impose néanmoins l’enregistrement d’une application dans un tenant Entra ; sa documentation indique qu’un compte Azure gratuit peut fournir ce tenant. L’application ne demande que `Mail.Send`, `User.Read` et `offline_access`.

Références officielles : [enregistrer l’application](https://learn.microsoft.com/en-us/graph/auth-register-app-v2), [flux Authorization Code avec PKCE](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow), [permission Mail.Send](https://learn.microsoft.com/en-us/graph/permissions-reference#mail-send), [API sendMail](https://learn.microsoft.com/en-us/graph/api/user-sendmail?view=graph-rest-1.0).

## Activation unique

1. Enregistrer une application Web prenant en charge les comptes Microsoft personnels.
2. Déclarer exactement cette URL de redirection : `https://wxdtqkltoqzsakkdiair.supabase.co/functions/v1/automation-outlook`.
3. Ajouter les permissions Microsoft Graph déléguées `Mail.Send` et `User.Read`. `offline_access` est demandé pendant le consentement.
4. Créer un secret client, puis stocker l’identifiant et le secret dans Supabase sous `MS_OAUTH_CLIENT_ID` et `MS_OAUTH_CLIENT_SECRET`. Ne jamais les placer dans une variable `VITE_`.
5. Dans Réglages > Automatisations internes, cliquer « Connecter Outlook » et sélectionner `Tada-Wind@outlook.com`. Toute autre boîte est refusée.

`AUTOMATION_ENCRYPTION_KEY` chiffre déjà les jetons OAuth dans la base. Le navigateur ne reçoit jamais ces jetons, le secret client ou la clé. Il apprend seulement si l’application est configurée et si la boîte est connectée.

## Parcours d’envoi

Aucun premier contact ne part automatiquement :

message approuvé → clic « Envoyer depuis Outlook » → second clic de confirmation → réservation en base → renouvellement éventuel du jeton → Graph `/me/sendMail` → statut `sent` → prospect `contacted`.

Le worker et les tâches planifiées ne peuvent pas appeler ce parcours à la place de l’utilisateur.

## Sécurité et absence de doublons

Le démarrage refuse un message non approuvé, une mauvaise révision, un autre canal, un prospect bloqué ou sans adresse, un message déjà envoyé et toute tentative déjà réservée. Un timeout ou une réponse ambiguë conserve le verrou : l’outil ne renvoie jamais automatiquement.

Le passage à `sent` a lieu après le `202` de Graph. Cela prouve que Microsoft a accepté la demande, pas que le destinataire l’a reçue. Les jetons d’accès et de renouvellement sont chiffrés en AES-GCM et les tables qui les contiennent sont inaccessibles aux rôles navigateur.

| Code | Action |
|---|---|
| `GRAPH_NOT_CONFIGURED` | enregistrer/configurer l’application Microsoft |
| `OUTLOOK_NOT_CONNECTED` | connecter la boîte depuis les réglages |
| `OUTLOOK_RECONNECT_REQUIRED` | refaire le consentement Microsoft |
| `GRAPH_REJECTED` | corriger l’adresse, le contenu ou la permission |
| `GRAPH_RATE_LIMITED` | attendre avant une nouvelle tentative explicite |
| `SEND_OUTCOME_UNKNOWN` | ne pas renvoyer ; vérifier les éléments envoyés |
| `SEND_RECONCILIATION_REQUIRED` | vérifier puis rapprocher la tentative avant toute action |

Tests sans email réel : `npm test`, `node scripts/prospector-release-check.mjs send-safety`, `npx playwright test` et contrôle Deno de toutes les fonctions.
