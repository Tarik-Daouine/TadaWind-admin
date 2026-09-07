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

`prospector_begin_send` prend un verrou consultatif et refuse : un message non approuvé, un canal autre qu'email, un message déjà envoyé, un envoi commencé il y a moins de deux minutes, une révision qui ne correspond plus, un prospect sans adresse. Le double-clic, le rechargement pendant l'appel et deux onglets ouverts butent tous sur le même verrou.

Le passage à `sent` n'a lieu qu'après un `202` de Graph. Si Graph échoue, la réservation est relâchée avec le motif : une nouvelle tentative explicite reste possible, mais elle reste **explicite**.

## Erreurs distinguées

| Code | Sens | Réessayer ? |
|---|---|---|
| `GRAPH_AUTH_FAILED` | secret expiré, permission non consentie | non, corriger la configuration |
| `GRAPH_REJECTED` | Graph refuse la requête (4xx) : adresse, contenu, politique | non à l'identique |
| `GRAPH_UNAVAILABLE` | 5xx ou 429 | oui, plus tard |
| `CONFIRM_FAILED` (207) | **l'email est parti**, le suivi n'a pas été écrit | ne pas renvoyer : recharger la file |

Le cas `CONFIRM_FAILED` est le seul où l'affichage peut mentir par excès de prudence. Il est signalé comme tel dans l'admin, précisément pour éviter un second envoi au même prospect.
