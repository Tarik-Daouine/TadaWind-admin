# Restauration des mails du formulaire — 15 septembre 2026

Le passage de Make à Brevo avait supprimé le HTML et changé le texte de confirmation. Le propriétaire a demandé de reprendre son email original fourni en EML : fond sombre, logo, accents rouges, récapitulatif personnalisé, délai de 24 à 48 heures et signature.

## Livré

- Confirmation reconstruite à partir du HTML original, avec prénom, lieu, date française et type de besoin. Objet : « Confirmation de votre demande de contact ».
- Texte de secours aligné. Message libre du visiteur exclu de la confirmation ; variables échappées dans le HTML.
- Notification interne habillée dans la même charte. Son ancien modèle exact n'a pas été fourni : cette présentation ne prétend pas le reproduire à l'identique.
- HTML enregistré dans l'outbox dans la même transaction que le lead. Une soumission répétée ne modifie pas les mails existants.
- Adaptateur Brevo : HTML + texte, destinataires et politique de non-réessai des envois incertains conservés.
- Migration `20260915100000_contact_html` appliquée ; `automation-worker` v8 et `contact-submit` v7 déployés.

Validation : 297 tests unitaires, contrôle Deno des deux fonctions, test SQL annulé (atomicité, doublons, objet et permissions), aperçu bureau/mobile sans débordement, logo chargé. Aucun nouveau mail envoyé pour ces tests. Rendu Outlook réel restant à vérifier.

## Prospection : retour utilisateur à respecter

Le propriétaire rejette les messages mécaniques qui commencent par « Sur votre site, vous indiquez… ». Ne pas lancer d'autres envois avec ce format. Le générateur actuel n'a pas encore été refondu : il impose une citation pour garantir la traçabilité. Déplacer la preuve dans l'interface de relecture demande une évolution explicite du contrat ; ne pas supprimer les contrôles de preuve pour améliorer le style.

Piste de rédaction à travailler, non envoyée :

> Bonjour,
>
> Je suis Tarik, vidéaste chez Tada Wind. Je vous contacte avec une idée de film pour l’Hôtel du Parc : une courte visite qui se terminerait au bord de la Vézère, pour donner envie de découvrir le lieu.
>
> Je peux vous préparer un déroulé simple, avec les plans envisagés pour votre site et vos réseaux. Est-ce que cela vous intéresserait ?
>
> Bonne journée,
> Tarik — Tada Wind
>
> Si vous préférez ne pas être recontacté, un simple retour suffit.

## Envois du 11 septembre : ne pas renvoyer

Les cinq messages ont été observés dans les éléments envoyés d'Outlook. L'enregistrement CRM était interrompu : Petit Manoir édité et approuvé, pas encore confirmé envoyé ; quatre autres brouillons restant à rapprocher. Ne pas confondre cet état CRM avec une absence d'envoi.

| Prospect | Heure Paris | Référence observée Outlook |
|---|---|---|
| Le Petit Manoir | 21:46 | AQAAAD6sVPIBAAAAwf00IwAAAAA= |
| La Ferme des Genestes | 21:47 | AQAAAD6sVPIBAAAAwf00JAAAAAA= |
| Hôtel Archambeau | 21:50 | AQAAAD6sVPIBAAAAwf00JQAAAAA= |
| Moulin de la Beune | 21:51 | AQAAAD6sVPIBAAAAwf00JgAAAAA= |
| Hôtel du Parc | 21:52 | AQAAAD6sVPIBAAAAwf00JwAAAAA= |

Il s'agit de confirmations de départ, pas de livraison ni de réponse.
