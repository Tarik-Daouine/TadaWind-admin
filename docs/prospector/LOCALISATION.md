# Communes des prospects

OpenStreetMap ne renseigne la commune que lorsqu'elle est saisie sur l'établissement. Quand elle manque, elle est retrouvée à partir des coordonnées exactes du point, via l'API publique de découpage administratif :
https://geo.api.gouv.fr/decoupage-administratif/communes

La commune contenant le point est utilisée, jamais la commune de départ de la campagne ni une ville voisine. Un résultat vide ou ambigu reste inconnu. Le code postal n'est complété que si l'API en fournit un seul. Aucun appel IA.

## Deux chemins, un seul comportement

**Pendant la découverte** (`completeLocations`) : complément en lot, quatre appels simultanés, douze secondes au total, coordonnées identiques mutualisées. Une panne ne bloque jamais la campagne — les compteurs `location.resolved / missing / errors` sont enregistrés dans les statistiques de campagne.

**Ensuite, en rattrapage durable** : tout prospect encore sans commune est repris par un job `locate`, avec les réessais et le backoff de la file. Le worker se réapprovisionne seul : quand il n'a plus rien à faire, `prospector_claim_jobs` appelle `prospector_enqueue_locations`, qui met en file jusqu'à 25 fiches. Le rattrapage ne passe donc jamais devant du travail réel, et **aucune commande manuelle n'est nécessaire** — y compris pour les fiches créées avant ce mécanisme.

## Ce qui empêche les boucles et les écrasements

`prospects.location_checked_at` horodate toute réponse **définitive**, qu'elle soit positive ou négative. Une commune trouvée, ou un point sans commune franche (hors France, en mer, limite ambiguë), ne sera plus jamais redemandé au service.

Une panne du service, elle, n'horodate rien : le job se réessaie, et si ses tentatives sont épuisées la fiche repasse au balayage après six heures. C'est ce qui rend la reprise après incident automatique.

`prospector_store_location` n'écrit que si la commune est **encore vide** et si les coordonnées **n'ont pas bougé** depuis la résolution. Une correction manuelle ou un ré-enrichissement ne peuvent pas être écrasés. Le code postal existant est conservé.

La provenance (fournisseur, URL, code INSEE, commune, coordonnées, date) est conservée dans `prospect_sources.extracted.location`, à côté des tags OSM d'origine — jamais présentée comme une donnée fournie par OSM dans son extrait original. Chaque résolution laisse un événement `location_resolved` ou `location_unknown` dans l'historique du prospect.

## Forcer un balayage

Utile seulement après une panne longue du service, quand les six heures d'attente sont trop lentes. Depuis l'admin connecté :

```sql
select public.prospector_enqueue_locations(200);
```

La fonction retourne le nombre de fiches mises en file. Elle ignore celles qui ont déjà une réponse définitive ou un job récent, et ne crée jamais de doublon.

## Limites

La commune dépend de l'exactitude du point OSM (centre du bâtiment ou de la surface). Ce traitement ne vérifie ni l'adresse postale complète, ni l'identité commerciale de l'établissement. L'interface À valider affiche « Commune à compléter » tant que la valeur manque.
