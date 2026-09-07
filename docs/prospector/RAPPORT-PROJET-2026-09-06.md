# Rapport du projet Tada Wind Prospector — 6 septembre 2026

État vérifié dans le dépôt, la PR GitHub nº 2 et la base Supabase. Ce rapport distingue l'objectif initial, les fonctions implémentées, les essais réalisés et le travail restant. Il ne déclenche aucun traitement ni envoi.

## 1. Conclusion

Le projet est un pilote fonctionnel intégré à l'admin, avec une chaîne complète allant de la découverte d'entreprises à un brouillon de message. Il n'est pas encore validé pour une exploitation commerciale régulière à plus grande échelle.

Le blocage technique principal de la rédaction a été levé. Le point prioritaire est maintenant la précision sémantique : vérifier que chaque citation démontre réellement toutes les affirmations du message. La nouvelle interface de génération par canal reste à publier. Aucun résultat commercial réel n'est encore mesuré.

## 2. Besoin métier

L'outil doit réduire le travail répétitif de prospection de Tada Wind : rechercher des entreprises locales pertinentes pour des prestations vidéo, drone et contenu visuel, recueillir des informations, prioriser les prospects, proposer un angle et préparer un message personnalisé.

Tarik garde la décision commerciale, la relecture, l'envoi et la relation. L'ambition initiale de prendre en charge 80–90 % du travail préparatoire est un objectif, pas un gain de temps déjà démontré.

La campagne réelle actuelle concerne les hôtels autour de Sarlat, dans un rayon de 25 km. Les autres catégories du brief constituent un périmètre à explorer progressivement ; elles ne sont pas toutes validées par les essais actuels.

## 3. Situation réelle des données

| Indicateur | État vérifié |
|---|---:|
| Campagnes | 1 : « Hôtels Sarlat 25 km », statut terminé |
| Prospects non supprimés | 50 |
| Sources enregistrées | 61 |
| Prospects avec analyse | 11 |
| Prospects avec stratégie | 10 |
| Prospects au statut nouveau | 39 |
| Prospects au statut qualifié | 10 |
| Prospects à valider | 1 |
| Messages conservés | 1 email, statut brouillon |
| Messages approuvés ou envoyés | 0 |
| Jobs en attente ou en cours | 0 |

Une campagne de découverte terminée ne signifie pas que tous ses prospects sont analysés. Les 39 fiches nouvelles ne sont pas actuellement en cours de traitement. Leur reprise doit être décidée après examen de leur intérêt et de la couverture du traitement initial.

Deux jobs de rédaction ont réussi sur le même prospect. La seconde génération a remplacé le premier brouillon : cela explique pourquoi un seul message est conservé.

Les erreurs présentes en base sont : quatre résolutions DNS impossibles, deux collectes sans contenu exploitable, une résolution vers une IP non publique bloquée, trois rédactions invalides, deux rédactions tronquées et neuf jobs explicitement arrêtés avec le motif `PARKED_CONTRACT_TOO_LARGE`. Ce sont des états enregistrés, pas des traitements qui continuent à tourner.

## 4. Fonctions disponibles dans le code

| Fonction | Ce qui existe | Limite actuelle |
|---|---|---|
| Réglages | Profil Tada Wind, zone, catégories, canaux, ton, barème et paramètres IA | La pertinence des réglages doit être évaluée commercialement |
| Recherche | Campagnes OpenStreetMap/Overpass, distance et déduplication | Une seule campagne réelle testée ; couverture OSM incomplète |
| Campagnes | Liste, progression, résultats et accès aux prospects | Fin de découverte distincte de fin de traitement IA |
| Prospects | Liste, filtres, fiches, ajout manuel, notes et historique | Données parfois absentes ou inaccessibles |
| Collecte | Lecture des sites accessibles et conservation d'extraits | Un extrait de texte ne prouve pas la qualité visuelle d'un site |
| Analyse | Synthèse et appréciations IA sur les sources disponibles | Les interprétations peuvent être erronées |
| Score | Calcul déterministe sur 100, ventilation et motifs | La précision des données et sous-notes reste déterminante |
| Stratégie | Angles de prestation et canal recommandé | Hypothèses commerciales, pas intention d'achat démontrée |
| Rédaction | Une variante par appel, preuves associées | Relecture sémantique indispensable |
| Validation | Édition, approbation, refus, report et opposition | Aucun envoi automatique |
| Contactés, relances, opportunités | Suivi des échéances et résultats d'échange | Parcours testés avec fixtures, sans retours commerciaux réels |
| Tableau de bord et budget | Compteurs, prochaines actions, suivi du plafond | Coûts estimés ; réservations historiques à rapprocher |

Le suivi des relances existe. Il ne faut pas le confondre avec un système qui rédige et envoie automatiquement des séquences de relance. Les intégrations email, la classification des réponses et l'enrichissement social avancé ne sont pas démontrés par cette V1.

## 5. Architecture et intégration dans l'admin

L'interface utilise React et Vite, avec les composants et styles existants de l'admin. Supabase fournit l'authentification et la base PostgreSQL. Les écritures sensibles passent par des fonctions serveur contrôlées. Les appels IA et la collecte web s'exécutent dans les Edge Functions, avec les secrets côté serveur.

Le worker traite les jobs un par un. GitHub Actions est configuré pour l'appeler toutes les cinq minutes ; ce rythme est une planification, pas une garantie d'exécution à la seconde près. Les jobs disposent d'un bail, de règles de reprise et d'erreurs identifiables.

Le module Prospection conserve ses propres données et parcours à côté du CRM existant. Il faut préserver cette séparation : une entreprise découverte n'est ni un client ni une opportunité confirmée.

État de livraison :

- Dernier commit de cette reprise : `8f483ac`, branche `codex/prospector-single-channel`.
- Migration `20260906180000` appliquée à Supabase.
- Worker version 17 déployé.
- [PR nº 2](https://github.com/Tarik-Daouine/TadaWind-admin/pull/2) ouverte, en brouillon, fusionnable au moment de la vérification.
- Aucun contrôle CI n'était remonté sur cette PR au moment de la lecture. Les validations rapportées ont été exécutées pendant le développement.
- La nouvelle interface de choix du canal n'est pas encore publiée depuis `main`.

## 6. Problèmes rencontrés et corrections

Le géocodage de la même référence à chaque campagne était fragile. Claude a fixé les coordonnées de Sarlat, ce qui a permis à la découverte réelle de fonctionner.

Le débit du worker a été amélioré : il peut enchaîner plusieurs petits jobs dans un cycle. Les appels IA longs limitent naturellement ce débit. Il ne faut donc pas annoncer vingt analyses IA par cycle sur la seule base du test de vingt jobs rapides.

La rédaction demandait initialement quatre variantes et beaucoup de métadonnées répétées. De plus, le raisonnement adaptatif de Sonnet 5 consommait par défaut une partie du plafond de sortie. Atteindre 16 000 tokens ne démontrait donc pas que le JSON visible faisait lui-même cette taille.

Le contrat final génère un canal à la fois et désactive ce raisonnement supplémentaire uniquement pour la rédaction. Chaque segment factuel contient directement son identifiant de source et son extrait de preuve. Le serveur reconstruit l'affirmation, son chemin, le type et l'URL de la source, puis applique les contrôles existants.

Le stockage a aussi été corrigé : il ne supprime plus les autres variantes et refuse d'écraser un message approuvé ou révisé par l'humain. Un premier contact déjà envoyé bloque la génération d'un nouveau premier contact.

## 7. Qualité réelle du premier message

Le dernier email pour Le Petit Manoir a été produit avec 850 tokens de sortie, pour un coût estimé de 0,0198 $. Il est stocké en brouillon, révision 1, avec la traçabilité structurelle validée.

Une première version affirmait que le site n'avait aucune vidéo, avec une citation qui ne le prouvait pas. La consigne renforcée a supprimé ce constat d'absence. Toutefois, le dernier texte évoque plusieurs caractéristiques alors que l'extrait cité dans le corps ne démontre à lui seul que la tour historique.

Conséquence : le validateur contrôle l'existence et la concordance des sources, les extraits littéraux et la couverture du texte. Il ne garantit pas que le sens de chaque affirmation est entièrement démontré. Le brouillon doit encore être relu et corrigé avant approbation. Le taux d'acceptation technique ne doit pas servir de mesure de qualité commerciale.

## 8. Tests et limites de validation

| Validation effectuée | Résultat | Ce qu'elle démontre |
|---|---|---|
| Tests unitaires | 156 réussis | Scoring, déduplication, collecte, contrats, preuves, budget et erreurs |
| Tests SQL de suivi et budget | Réussis, transaction annulée | Transitions, suivi après contact et réservation budgétaire |
| Tests SQL par canal | Réussis, transaction annulée | Protection du travail humain, conservation des variantes, refus des demandes invalides |
| Scénarios navigateur | Six scénarios distincts réussis | Navigation et actions d'interface ; REST simulé pour la prospection |
| Session admin sauvegardée | Un scénario ignoré | Ce parcours n'est pas couvert par ce résultat |
| Compilation et vérification Deno | Réussies | Code compilable et types du worker vérifiés |
| Essais de production | Chaîne complète jusqu'au brouillon | Fonctionnement réel des sources, de l'IA et du stockage |

Ces vérifications ne constituent ni un audit de sécurité exhaustif, ni une validation statistique de la qualité IA, ni une preuve de retour commercial. Le bundle frontend conserve un avertissement de taille connu.

## 9. Budget

| Mesure | Valeur |
|---|---:|
| Plafond mensuel configuré | 10,00 € |
| Coûts estimés enregistrés en USD | 1,0697 $ |
| Engagement interne total | 1,457423 € |
| Dont quatre réservations anciennes non réglées | 0,38757 € |
| Marge restante selon le compteur interne | Environ 8,54 € |
| Dernier appel de rédaction réussi | 0,0198 $ |

Le calcul interne utilise actuellement `eur_per_usd = 1`. C'est un paramètre de conversion, pas une cotation de change actualisée. Les coûts enregistrés sont des estimations à rapprocher de la facturation du fournisseur.

Un timeout ne prouve pas qu'un appel n'a pas été facturé. Les anciennes réservations ne doivent donc pas être remboursées arbitrairement. Le prix du dernier email ne représente pas le coût complet d'un prospect : il faut inclure l'analyse, la stratégie et les éventuels essais ou corrections.

## 10. Priorités pour la suite

| Ordre | Travail | Critère de sortie |
|---|---|---|
| 1 | Corriger la qualité des preuves et du brouillon pilote | Chaque affirmation est démontrée par l'extrait cité ou retirée ; message court, pertinent et relu |
| 2 | Revoir et intégrer la PR, publier le choix du canal | Parcours vérifié dans l'admin publié ; aucun écrasement du travail humain |
| 3 | Renforcer l'exploitation et le suivi budgétaire | Échecs de jobs visibles, CI de tests sur PR, traitement documenté des réservations incertaines |
| 4 | Lancer un pilote de cinq prospects sélectionnés | Chaque message relu ; coût complet, corrections et temps de revue mesurés |
| 5 | Reprendre progressivement les fiches et jobs arrêtés | Priorité métier définie, budget respecté, pas de reprise globale non contrôlée |
| 6 | Mesurer les premiers retours commerciaux | Envois manuels tracés, réponses, rendez-vous et opportunités suivis |

La fusion d'une PR ne prouve pas qu'un déploiement fonctionne, et un workflow GitHub réussi ne prouve pas que tous ses jobs applicatifs ont réussi : il faut aussi vérifier les résultats en base.

Pour le pilote, les mesures utiles sont le coût complet par prospect, le temps de relecture, la part de messages nécessitant une correction factuelle, puis les réponses et rendez-vous obtenus. Un score élevé ou un grand nombre de brouillons ne remplace pas ces résultats.

## 11. Ce qu'il faut éviter maintenant

- Relancer toute la file ou multiplier les catégories avant d'avoir stabilisé la qualité.
- Confondre absence d'information et preuve d'un manque chez le prospect.
- Présenter le score comme une probabilité de vente ou une évaluation objective de l'entreprise.
- Ajouter des sources payantes avant de mesurer les limites de la source actuelle.
- Mettre des clés IA côté navigateur, contourner les contrôles serveur ou automatiser les approbations.
- Réutiliser une génération de premier contact comme une relance automatique.
- Libérer les réservations historiques sans rapprochement de facturation.

## 12. Décisions déjà prises et périmètre à garder

Le budget de 10 €/mois est décidé. La découverte OSM, Anthropic, la référence Sarlat et le déclenchement GitHub Actions fonctionnent dans le pilote. Ces choix ne sont plus des questions ouvertes comme dans les premières notes du projet.

La prochaine étape utile est un lot court centré sur les preuves et la publication de l'interface, suivi d'un pilote commercial limité. Les connecteurs de messagerie, l'enrichissement social avancé et les automatisations plus larges restent des évolutions ultérieures, à justifier par les résultats de ce pilote.

Références : [plan historique et état des lots](PLAN-ACTION.md), [détails du correctif de rédaction](SINGLE-CHANNEL.md), [PR nº 2](https://github.com/Tarik-Daouine/TadaWind-admin/pull/2).
