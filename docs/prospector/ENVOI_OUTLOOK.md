# Envoi Outlook (Microsoft Graph)

L'architecture est en place et **inactive tant que les identifiants ne sont pas déclarés**. Aucun code n'est à modifier pour l'activer : la fonction se sonde elle-même.

## Règle qui ne se contourne pas

Aucun premier contact ne part automatiquement. Le chemin est toujours :

message approuvé par un humain → clic « Envoyer » → second clic de confirmation → Edge Function → Graph → `sent` → prospect `contacted`.

Le worker n'a aucun accès à cette fonction. Le cron ne peut pas envoyer d'email.

## Où vivent les identifiants

Dans les **secrets Supabase**, jamais dans Vite. Tout ce qui commence par `VITE_` est compilé en clair dans le bundle public : y mettre un secret Microsoft reviendrait à le publier.

```bash
supabase secrets set MS_GRAPH_TENANT_ID=... MS_GRAPH_CLIENT_ID=... MS_GRAPH_CLIENT_SECRET=... MS_GRAPH_SENDER=Tada-Wind@outlook.com
```

`.env.example` ne contient que les **noms** de ces variables, en commentaire, pour mémoire.

## Ce que le navigateur apprend

Uniquement le verdict de la sonde :

```
POST /functions/v1/prospector-send-email  {"probe": true}
→ {"configured": false, "missing": [...], "sender": null}
```

`missing` liste des noms de variables, jamais de valeurs. `sender` est l'adresse d'expédition, publique par nature. Tant que `configured` est faux, le bouton reste désactivé et l'admin propose « Copier » vers Outlook.

## Côté Azure

Enregistrer une application, lui accorder la permission d'application **`Mail.Send`** avec consentement administrateur, puis créer un secret client. Le flux est `client_credentials` : pas de connexion interactive, donc pas de session à renouveler — seulement le secret, à faire expirer et remplacer.

Restreindre l'application à la seule boîte d'envoi via une *application access policy* Exchange est fortement recommandé : sans elle, `Mail.Send` d'application autorise l'envoi depuis **toutes** les boîtes du tenant.

## Ce qui empêche le double envoi

`prospector_begin_send` prend un verrou consultatif et refuse : un message non approuvé, un canal autre qu'email, un message déjà envoyé, toute réservation d'envoi existante, une révision qui ne correspond plus, un prospect sans adresse. Le verrou **ne périme jamais** : un crash ou un timeout ne prouvent pas l'absence d'envoi. Le double-clic, le rechargement et deux onglets butent sur le même verrou. Le texte et sa révision restent protégés pendant cette période.

Le passage à `sent` n'a lieu qu'après un `202` de Graph (acceptation de la demande, pas preuve de livraison). La réservation n'est relâchée que si aucun appel `sendMail` n'a commencé, ou après refus HTTP explicite (4xx sauf 408). Les erreurs réseau, 408, 5xx, réponses inattendues et échecs de confirmation conservent le verrou. Même la perte de la réponse après une confirmation réussie ne permet pas un nouvel envoi : la base conserve `sent`.

## Erreurs distinguées

| Code | Sens | Réessayer ? |
|---|---|---|
| `GRAPH_AUTH_FAILED` | secret expiré, permission non consentie | non, corriger la configuration |
| `GRAPH_REJECTED` | Graph refuse la requête (4xx) : adresse, contenu, politique | non à l'identique |
| `GRAPH_RATE_LIMITED` | refus 429 | oui, plus tard |
| `SEND_OUTCOME_UNKNOWN` | timeout, 408, 5xx ou réponse ambiguë pendant l'envoi | **non**, vérifier Outlook |
| `SEND_RECONCILIATION_REQUIRED` | réservation persistante, ou libération non confirmée | **non**, vérifier l'état avant déverrouillage |
| `CONFIRM_FAILED` (207) | Microsoft a accepté la demande, mais le suivi n'a pas été enregistré | **ne pas renvoyer**, vérifier Outlook puis confirmer le suivi |

## Rapprocher un envoi incertain

1. Ne pas renvoyer, y compris par copier-coller manuel. Vérifier le destinataire, l'objet, le texte et l'heure dans les éléments envoyés Outlook ; si nécessaire attendre et consulter les traces Microsoft. Une absence immédiate dans le dossier ne prouve pas un échec.
2. Si l'envoi est confirmé, utiliser « Je l'ai envoyé » avec une référence. Cela met à jour le suivi sans émettre d'email.
3. Si l'absence d'envoi est établie, un opérateur serveur peut appeler `prospector_release_send(p_id, p_lock_at, p_reason)` avec l'identifiant, la valeur exacte actuelle de `send_lock_at` et les éléments de vérification. Cette RPC est réservée à `service_role`, compare la tentative et journalise le motif. Ne jamais déverrouiller un lot à l'aveugle.
4. Si l'issue demeure inconnue, conserver le verrou. Aucun réessai automatique.

Tests sans email réel : `npm test`, `node scripts/prospector-release-check.mjs send-safety` (schéma isolé, rollback), `npx playwright test` (Microsoft et données simulés).
