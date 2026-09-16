# Aperçu propriétaire — 16 septembre 2026

L’éditeur email propose « M’envoyer un aperçu ». Le serveur prend la version enregistrée du brouillon, ajoute la signature partagée et envoie via Brevo uniquement à `PROSPECTOR_PREVIEW_RECIPIENT`. Le navigateur ne choisit ni le destinataire ni le contenu transmis. Cet aperçu ne modifie pas le statut du prospect et ne valide pas l’envoi Outlook.

Une seule tentative par utilisateur, message et révision ; réservation avant appel réseau. Un résultat incertain ne déclenche aucun nouvel envoi automatique. Limite de trois aperçus par heure et plafond partagé de 300 tentatives sur 24 heures avec les confirmations du formulaire. Les appels sont réservés aux sessions authentifiées non anonymes.

Les commandes de copie puis confirmation manuelle sont retirées pour le canal email. Ne jamais remplacer un test de l’outil par un envoi composé dans Outlook. Les cinq envois historiques du 11 septembre restent à rapprocher : voir `../CONTACT-MAIL-RESTORATION-2026-09-15.md`. Ne pas les renvoyer.

Déploiement backend : migration `20260916100000_prospector_preview`, fonction `prospector-preview-email`, destinataire fixe configuré vers la boîte Gmail du propriétaire. Tests : 306 tests unitaires et cinq scénarios Playwright ciblés, build et contrôle Deno réussis. Les tests automatisés simulent le fournisseur et n’envoient pas de mails. Assertions SQL vérifiées dans une transaction annulée : réservation, doublon, copie du texte enregistré, révision périmée et permissions.

Limite restante : le chemin Outlook utilise encore les permissions applicatives Microsoft Graph ; la boîte personnelle Outlook nécessite une intégration déléguée. Les secrets d’application absents ne sont donc pas le seul problème. Ne pas annoncer que l’aperçu Brevo valide l’envoi aux prospects. Le style du générateur reste également à revoir en préservant ses preuves.
