# Remplacer Make — état et bascule

## Estimation initiale

Ordre de grandeur : 3 à 5 journées de développement et vérification, incluant formulaire, emails, supervision et publication vidéo. Il s'agit d'une estimation d'effort, pas d'un devis ni d'un délai de disponibilité des accès Microsoft. Aucun appel IA n'est nécessaire à ces automatismes. Les coûts récurrents dépendent des quotas Supabase, GitHub et de l'hébergement vidéo choisi ; aucun nouvel abonnement n'a été souscrit.

La perte des vidéos et le projet de migration vers YouTube ou Vimeo changent le périmètre : ne pas développer de synchronisation supplémentaire avec Streamable. Les références existantes sont conservées. Les tournages, le montage et la récupération éventuelle des originaux sont un chantier distinct, non inclus dans l'estimation logicielle.

## Fonctionnement construit

- `contact-submit` valide les champs, borne la taille, vérifie le consentement, écarte le honeypot, impose une référence d'idempotence et appelle une transaction SQL unique.
- Cette transaction crée la demande CRM et deux emails en file : notification interne et accusé de réception. Répéter la même référence et les mêmes données ne crée pas un second envoi. La même référence avec un autre contenu est refusée.
- Les limites serveur sont de 5 demandes par adresse et par heure, et 100 demandes au total par heure. Ce sont des garde-fous de débit, pas une preuve qu'un visiteur est humain. Une attaque distribuée peut encore saturer le plafond global ; une protection CAPTCHA peut être ajoutée si les observations le nécessitent.
- `automation-worker` envoie via Brevo pour le formulaire. Il démarre après une demande et dispose d'un passage de secours programmé dans GitHub Actions toutes les 5 minutes. GitHub peut retarder les exécutions : ne pas promettre une livraison immédiate.
- Les emails internes et visiteurs sont indépendants : un échec de notification interne ne supprime pas l'accusé de réception.
- Un HTTP 201 avec une référence Brevo signifie « accepté par le service ». Un timeout/408/5xx reste incertain et n'est jamais renvoyé automatiquement. Seul un refus 429 est retenté automatiquement, au maximum 3 tentatives. Une interruption du worker rend la tentative incertaine après 5 minutes.
- Réglages → Automatisations internes affiche l'expéditeur Brevo, les tentatives des dernières 24 heures rapportées au plafond, et les 20 derniers emails avec leur fournisseur et leur référence d'envoi.
- Prospector conserve son approbation et son clic explicites ; aucun message commercial ne passe par Brevo.

## Vidéos

Dans l'éditeur de projet, coller une URL YouTube ou Vimeo. Les liens Vimeo non répertoriés conservent leur code d'accès. Le site utilise le lecteur correspondant uniquement quand le visiteur clique. Le projet n'est pas publié automatiquement et aucune référence ancienne n'est supprimée.

Cette étape remplace l'intermédiaire Notion pour la publication du portfolio ; elle n'aspire pas automatiquement toutes les vidéos d'un compte. Le choix du fournisseur et la reconstitution des vidéos précèdent une éventuelle synchronisation de chaîne. Aucun fichier original n'est sauvegardé par cette intégration : conserver deux copies indépendantes des nouveaux rushes et exports.

## Consentement délégué Outlook retiré — 10 septembre 2026

Le passage à Brevo a retiré le bouton « Connecter Outlook » du panneau Réglages. Plus rien n'appelait alors `automation-outlook` : le consentement ne pouvait plus être accordé, donc `automation_connections` ne pouvait plus recevoir de jeton, donc le chemin délégué de `prospector-send-email` ne pouvait plus s'activer. Du code injoignable qui donnait l'illusion d'une fonctionnalité disponible.

Ont été retirés : la fonction `automation-outlook` et son flux OAuth/PKCE, le chiffrement AES-GCM des jetons (`encrypt`/`decrypt`), la lecture déléguée dans `prospector-send-email`, et les tables `automation_connections` et `automation_oauth_states` — vides, aucun consentement n'ayant jamais été accordé. La migration refuse de s'appliquer si un jeton s'y trouve.

`AUTOMATION_ENCRYPTION_KEY` **reste nécessaire** : `contact-submit` s'en sert comme sel du hachage d'adresse qui alimente la limite de 5 demandes par email et par heure. Ce n'est plus une clé de chiffrement, seulement un sel — la remplacer remet les compteurs de débit à zéro.

Reprendre l'envoi commercial automatique demanderait soit un compte Microsoft 365 (les quatre secrets `MS_GRAPH_*` suffisent alors, le code est déjà là), soit de réécrire un consentement délégué. Ce n'est pas un chantier en cours.

## Brevo remplace Microsoft pour les emails du formulaire — décision du 9 septembre 2026

Le compte gratuit Brevo sert uniquement de transport pour les notifications et accusés de réception du formulaire. Le CRM, les modèles de texte, la file, l'idempotence et le suivi restent dans Supabase et l'admin. Aucune liste de prospection n'est importée dans Brevo. L'envoi commercial reste manuel depuis Outlook. La fonction `prospector-send-email` est conservée pour un futur compte Microsoft 365 : elle n'a qu'un chemin, l'application Microsoft avec la permission `Mail.Send` d'application, et sa sonde répond « non configuré » tant que les quatre secrets `MS_GRAPH_*` manquent — le bouton d'envoi reste donc fermé.

### Configuration nécessaire

1. Créer un compte **Brevo Free** avec `Tada-Wind@outlook.com`, sans carte bancaire, sans essai payant et sans achat de crédits. La création du mot de passe et l'acceptation des conditions reviennent au titulaire du compte.
2. Authentifier `tadawind.com` avec les enregistrements DNS exacts fournis par Brevo (code de vérification, DKIM, DMARC suivant l'état du domaine). Ne pas remplacer les MX ou effacer un SPF/DMARC existant. Vérifier d'abord les valeurs déjà publiées.
3. Déclarer l'expéditeur `contact@tadawind.com` sous le nom TadaWind. Cette adresse d'envoi ne crée pas une boîte de réception. Le champ Reply-To des emails pointe vers `Tada-Wind@outlook.com`.
4. Créer la clé API et la conserver uniquement dans le secret Supabase `BREVO_API_KEY`. Configurer `BREVO_SENDER_EMAIL=contact@tadawind.com`. Ne jamais mettre la clé dans une variable VITE, Git ou une conversation. La clé API doit être réservée à cette intégration.
5. Vérifier dans Brevo que l'expéditeur est authentifié et que l'envoi transactionnel est activé. « Paramètres présents » dans l'admin ne prouve pas ces validations.

La clé existante `AUTOMATION_ENCRYPTION_KEY` reste nécessaire au hachage salé des contacts et au code Outlook conservé ; ne pas la remplacer. Les secrets `MS_OAUTH_*` ne sont pas nécessaires pour Brevo.

### Plafond et limites

L'offre gratuite affiche 300 emails par jour ; la documentation annonce également la mention « Sent with Brevo ». Aucun abonnement payant n'est requis pour ce lot. Ces conditions fournisseur sont celles consultées le 9 septembre 2026, pas une garantie de tarifs futurs.

Notre serveur impose **300 tentatives sur 24 heures glissantes**. Chaque réservation, y compris un refus ou un timeout, consomme une place. Le verrou SQL sérialise les réservations des workers concurrents. Au plafond, les emails restent en attente et le worker retourne `BREVO_LOCAL_QUOTA_REACHED`. Une place redevient disponible 24 heures après sa réservation. Il n'existe aucun achat de crédits ni montée de forfait automatique dans notre code.

Ce compteur couvre cette application seulement, pas les envois faits directement dans Brevo ou par une autre intégration. Le plafond fournisseur et les règles d'activation du compte s'appliquent également. Le renouvellement du domaine et les quotas de l'infrastructure Supabase/GitHub restent distincts ; le plafond email ne garantit pas la gratuité de toute l'infrastructure.

### Réponses du service

- HTTP 201 **avec un messageId** : `accepted`, référence Brevo enregistrée. Ce n'est pas une preuve de livraison dans la boîte du destinataire.
- HTTP 429 : attente et nouvelle tentative, au maximum trois, chacune comptée dans le plafond.
- HTTP 401/403 : `BREVO_AUTH_FAILED`. Autre refus 4xx hors 408 : échec explicite ; `not_enough_credits` devient `BREVO_QUOTA_EXHAUSTED`.
- Timeout, HTTP 408/5xx ou succès sans reçu exploitable : résultat incertain, aucun renvoi automatique.
- Échec d'enregistrement du résultat : arrêt immédiat ; la tentative en cours deviendra incertaine après cinq minutes.

Références : [API d'envoi Brevo](https://developers.brevo.com/reference/send-transac-email), [limites du forfait gratuit](https://help.brevo.com/hc/en-us/articles/208580669-FAQs-What-are-the-limits-of-the-Free-plan).

## Côté site

Depuis le 11 septembre 2026, le site publié appelle exclusivement `POST contact-submit`. Le repli historique et le webhook Make ont été retirés (site PR #5, merge `9a8358b`). La sonde GET reste un indicateur de configuration, elle ne choisit plus le circuit côté site.

La référence UUID est conservée pour une saisie identique après une réponse incertaine. Une nouvelle tentative ne crée donc pas une deuxième demande. Le formulaire affiche une erreur persistante et conserve les champs si le backend est indisponible. Désactiver le secret ferme désormais le formulaire : cela ne réactive pas Make.

## État vérifié le 11 septembre 2026

- Domaine et expéditeur `contact@tadawind.com` authentifiés ; nouvelle clé enregistrée dans Supabase.
- Deux pilotes du 10 septembre : quatre messages confirmés délivrés par Brevo. La première notification a subi un retard jusqu'au lendemain ; ne pas confondre acceptation et livraison, ni la renvoyer automatiquement.
- `CONTACT_INTERNAL_ENABLED=true` ; code public sans Make vérifié après déploiement Vercel.
- Test du point d'entrée public : référence `535824cc-27bc-4a64-91c1-4478eebfb7b8`, première requête acceptée, deuxième identique reconnue comme doublon. Les deux emails sont confirmés délivrés par Brevo ; une seule ligne CRM vérifiée malgré les deux requêtes.
- Migration `20260911081022_contact_internal_only` appliquée : suppression de la politique `public_insert_lead` et retrait INSERT à anon ; droits service_role et authenticated conservés.
- Neuf tests Playwright du site passent, dont échec réseau et nouvelle tentative avec la même référence.
- Reste : se reconnecter à Make, vérifier les exécutions/files puis désactiver le scénario formulaire. Le site ne l'appelle déjà plus. Ne pas prétendre que le scénario est arrêté sans vérifier son état.
- La migration vidéo YouTube/Vimeo et l'arrêt de l'ancien scénario Streamable restent séparés.

## Séquence de bascule — procédure de référence

1. Déployer la migration Brevo, le worker, la fonction de statut et l'interface en gardant `CONTACT_INTERNAL_ENABLED` désactivé. Le site continue sur Make.
2. Terminer le compte gratuit, la validation du domaine/expéditeur et les secrets Brevo.
3. Créer via le backend une demande de test contrôlée, avec TadaWind comme destinataire des deux messages, puis exécuter le worker. Vérifier le reçu Brevo et la réception réelle des deux emails dans Outlook. Vérifier l'idempotence sans envoyer à un prospect. Le point d'entrée public reste désactivé pendant ce test.
4. Passer `CONTACT_INTERNAL_ENABLED` à `true` et vérifier une demande publique contrôlée, sans insertion directe ni appel Make.
5. Déployer le site avec un circuit interne exclusif après acceptation des tests. Retirer le repli `legacySubmit` et le webhook Make, puis révoquer `INSERT` sur `public.leads` pour `anon`. Conserver les droits service_role/admin.
6. Contrôler la file de webhooks et les exécutions Make encore en cours avant de désactiver le scénario formulaire. Les anciens onglets doivent être rechargés. Conserver les scénarios comme archive réversible pendant l'observation. Désactiver Streamable après vérification qu'aucun autre usage Notion n'en dépend.
7. Mettre la politique de confidentialité du site à jour pour décrire le circuit réellement actif et le rôle de Brevo.

Tant que la réception réelle n'est pas vérifiée, **Make reste actif**. Le formulaire interne n'est pas activé par le simple déploiement du code.

## Reprise d'un résultat incertain

Vérifier le destinataire, l'heure et la référence de la demande dans les journaux transactionnels Brevo, en utilisant `provider_message_id` et la référence TadaWind. Pour les anciennes lignes marquées Outlook, consulter les éléments envoyés Outlook. Ne pas remettre aveuglément l'email en attente. La levée du blocage reste une opération backend réservée à un rapprochement documenté ; le navigateur n'a pas le droit de modifier la file. Sans preuve, conserver l'état incertain.

## Vérification

Tests unitaires de validation, URLs vidéo, chiffrement et worker ; tests navigateur des deux chemins de contact avec appels externes interceptés ; contrôle TypeScript des Edge Functions ; tests SQL atomiques/idempotence/droits dans une transaction annulée. Ces tests ne remplacent pas le test réel de réception des emails Brevo avant bascule.

Les assertions SQL s'exécutent avec :

```bash
node scripts/prospector-release-check.mjs internal-automations
```

Elles portent sur le schéma réel, dans une transaction annulée — `leads` étant une table héritée, le rejeu en schéma isolé utilisé par les autres contrôles ne peut pas la couvrir. Rien n'est laissé en base ; c'est vérifiable en comptant les lignes `leads` dont l'`ID` commence par `FORM-` avant et après.


Contrôle Brevo : `node scripts/prospector-release-check.mjs brevo`. Il prend des verrous brefs, exige une file vide et annule toutes les écritures. Dès que la file contient de vraies données, exécuter ce contrôle sur une base de test. Le test couvre le plafond, l'expiration de la fenêtre, l'absence de reprise d'un résultat incertain, les droits et l'enregistrement du reçu avec l'identifiant exact de tentative.


## État de reprise — 9 septembre 2026

- Branche `codex/brevo-contact` : adaptation Brevo du worker, statut authentifié, compteur dans Réglages et documentation.
- Migration `20260909130000_brevo_contact` appliquée ; `automation-worker` v2 et `automation-status` v1 déployés.
- Les secrets Brevo ne sont pas encore configurés. L'inscription est ouverte dans le navigateur ; le titulaire doit créer son mot de passe et terminer le compte gratuit.
- `GET contact-submit` répond encore `enabled:false`. Aucun email réel envoyé, aucune dépense Brevo déclenchée. Make reste actif.
- Validation locale : 294 tests unitaires au total (291 puis 3 tests du statut), 9 tests navigateur réussis et 1 ignoré faute de session enregistrée ; build et contrôle Deno réussis. Contrôles SQL du quota, droits, identifiant de tentative et résultat incertain réussis puis annulés, tables de file/tentatives vides après contrôle.
- Avant bascule : compte Free, domaine et expéditeur validés, clé serveur, test réel des deux emails. Ne pas reprendre la création d'un annuaire Entra pour ce chantier.
