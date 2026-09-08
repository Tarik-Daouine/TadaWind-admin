# Remplacer Make — état et bascule

## Estimation initiale

Ordre de grandeur : 3 à 5 journées de développement et vérification, incluant formulaire, emails, supervision et publication vidéo. Il s'agit d'une estimation d'effort, pas d'un devis ni d'un délai de disponibilité des accès Microsoft. Aucun appel IA n'est nécessaire à ces automatismes. Les coûts récurrents dépendent des quotas Supabase, GitHub et de l'hébergement vidéo choisi ; aucun nouvel abonnement n'a été souscrit.

La perte des vidéos et le projet de migration vers YouTube ou Vimeo changent le périmètre : ne pas développer de synchronisation supplémentaire avec Streamable. Les références existantes sont conservées. Les tournages, le montage et la récupération éventuelle des originaux sont un chantier distinct, non inclus dans l'estimation logicielle.

## Fonctionnement construit

- `contact-submit` valide les champs, borne la taille, vérifie le consentement, écarte le honeypot, impose une référence d'idempotence et appelle une transaction SQL unique.
- Cette transaction crée la demande CRM et deux emails en file : notification interne et accusé de réception. Répéter la même référence et les mêmes données ne crée pas un second envoi. La même référence avec un autre contenu est refusée.
- Les limites serveur sont de 5 demandes par adresse et par heure, et 100 demandes au total par heure. Ce sont des garde-fous de débit, pas une preuve qu'un visiteur est humain. Une attaque distribuée peut encore saturer le plafond global ; une protection CAPTCHA peut être ajoutée si les observations le nécessitent.
- `automation-worker` envoie via Microsoft Graph. Il démarre après une demande et dispose d'un passage de secours programmé dans GitHub Actions toutes les 5 minutes. GitHub peut retarder les exécutions : ne pas promettre une livraison immédiate.
- Les emails internes et visiteurs sont indépendants : un échec de notification interne ne supprime pas l'accusé de réception.
- Un HTTP 202 signifie « accepté par Outlook ». Un timeout/408/5xx reste incertain et n'est jamais renvoyé automatiquement. Seul un refus 429 est retenté automatiquement, au maximum 3 tentatives. Une interruption du worker rend la tentative incertaine après 5 minutes.
- Les jetons Outlook sont chiffrés AES-GCM avec une clé conservée dans les secrets Supabase. Les tables des jetons et des états OAuth sont inaccessibles au navigateur. Le consentement utilise un état aléatoire à usage unique et PKCE.
- Réglages → Automatisations internes affiche la connexion et les 20 derniers emails.
- Le même compte connecté sert à l'envoi Prospector, qui conserve l'approbation et le clic explicites.

## Vidéos

Dans l'éditeur de projet, coller une URL YouTube ou Vimeo. Les liens Vimeo non répertoriés conservent leur code d'accès. Le site utilise le lecteur correspondant uniquement quand le visiteur clique. Le projet n'est pas publié automatiquement et aucune référence ancienne n'est supprimée.

Cette étape remplace l'intermédiaire Notion pour la publication du portfolio ; elle n'aspire pas automatiquement toutes les vidéos d'un compte. Le choix du fournisseur et la reconstitution des vidéos précèdent une éventuelle synchronisation de chaîne. Aucun fichier original n'est sauvegardé par cette intégration : conserver deux copies indépendantes des nouveaux rushes et exports.

## Configuration Microsoft encore nécessaire

Créer/enregistrer une application appartenant à TadaWind dans Microsoft Entra, acceptant les comptes Microsoft personnels, avec une plateforme **Web** et cette URL de retour exacte :

`https://wxdtqkltoqzsakkdiair.supabase.co/functions/v1/automation-outlook`

Permissions déléguées : `Mail.Send`, `User.Read`, `offline_access`. Aucune lecture des emails n'est demandée. Configurer les secrets Supabase `MS_OAUTH_CLIENT_ID` et `MS_OAUTH_CLIENT_SECRET`. La clé `AUTOMATION_ENCRYPTION_KEY` est déjà créée ; ne pas la remplacer sans migrer les jetons chiffrés.

Puis Réglages → Automatisations internes → Connecter Outlook, avec **Tada-Wind@outlook.com**. Le backend refuse une autre boîte. La connexion détenue par Make ne peut pas être réutilisée en copiant ses jetons.

Référence : [Microsoft — flux de code d'autorisation et PKCE](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow).

## Côté site

Le formulaire de `www.tadawind.com` lit la sonde `GET contact-submit` sans cache, à chaque envoi, puis choisit son circuit **avant d'émettre quoi que ce soit** :

- sonde à `true` → un seul appel `POST contact-submit`, qui enregistre la demande et met les deux emails en file. Ni insertion directe, ni webhook Make ;
- sonde à `false` → circuit historique inchangé : insertion du lead depuis le navigateur, puis webhook Make ;
- sonde injoignable → circuit historique, sûr puisque rien n'a encore été émis.

Un envoi interne qui échoue **ne repart jamais vers Make**. La demande a peut-être été acceptée malgré une réponse perdue, et le visiteur recevrait deux accusés pour une seule demande. Le message d'erreur invite à réessayer ; la référence d'idempotence évite alors le doublon.

Cette référence est un UUID v4 stable tant que la saisie ne change pas. Elle se renouvelle dès que le visiteur corrige un champ — et après un `IDEMPOTENCY_CONFLICT`, sans quoi il resterait bloqué dessus. Le piège à robots (`website`) est présent dans le formulaire, hors du parcours clavier.

La bascule ne demande donc **aucun redéploiement du site** : basculer le secret suffit, et le site suit à l'envoi suivant.

## Séquence de bascule — pas encore réalisée

1. Déployer les migrations, fonctions et interface. Vérifier que `GET contact-submit` répond `enabled:false`. Le site continue alors à utiliser le circuit actuel.
2. Configurer l'application Microsoft et connecter le compte TadaWind.
3. Effectuer une demande de test contrôlée vers la boîte TadaWind dans le nouveau circuit. Vérifier les deux acceptations et les messages reçus. Tester également une erreur et une répétition de la même référence, sans contacter de prospect réel.
4. Passer le secret `CONTACT_INTERNAL_ENABLED` à `true` et vérifier la bascule publique. Le formulaire lit cet état sans cache ; un appel interne échoué ne retombe jamais sur Make. Aucun redéploiement du site n'est nécessaire.
5. Révoquer `INSERT` sur `public.leads` pour `anon`, après vérification du parcours interne. Les anciens onglets devront être rechargés. Les droits service_role et de l'admin restent nécessaires.
6. Contrôler les exécutions Make encore en cours et leur file de webhooks, puis désactiver le scénario formulaire. Désactiver le scénario Streamable après vérification qu'aucun autre usage Notion n'en dépend. Conserver les scénarios comme archive réversible pendant la période d'observation.
7. Retirer du site le chemin de transition `legacySubmit` et le webhook Make, puis mettre la politique de confidentialité à jour pour refléter le circuit effectivement actif.

Tant que l'étape Microsoft n'est pas terminée, **Make n'est pas retiré**. Désactiver l'ancien circuit maintenant interromprait les emails des visiteurs.

## Reprise d'un résultat incertain

Vérifier le destinataire, l'heure et la référence de la demande dans les éléments envoyés Outlook. Ne pas remettre aveuglément l'email en attente. La levée du blocage reste une opération backend réservée à un rapprochement documenté ; le navigateur n'a pas le droit de modifier la file. Sans preuve, conserver l'état incertain.

## Vérification

Tests unitaires de validation, URLs vidéo, chiffrement et worker ; tests navigateur des deux chemins de contact avec appels externes interceptés ; contrôle TypeScript des Edge Functions ; tests SQL atomiques/idempotence/droits dans une transaction annulée. Ces tests ne remplacent pas le test réel de consentement et d'envoi Microsoft avant bascule.

Les assertions SQL s'exécutent avec :

```bash
node scripts/prospector-release-check.mjs internal-automations
```

Elles portent sur le schéma réel, dans une transaction annulée — `leads` étant une table héritée, le rejeu en schéma isolé utilisé par les autres contrôles ne peut pas la couvrir. Rien n'est laissé en base ; c'est vérifiable en comptant les lignes `leads` dont l'`ID` commence par `FORM-` avant et après.
