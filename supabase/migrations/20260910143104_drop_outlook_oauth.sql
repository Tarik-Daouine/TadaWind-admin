-- Retrait du consentement délégué Outlook.
--
-- Le panneau Réglages a perdu son bouton « Connecter Outlook » lors du passage
-- à Brevo : plus rien n'appelait `automation-outlook`, donc plus rien ne pouvait
-- écrire dans ces deux tables, ni lire un jeton qui n'existerait jamais.
--
-- Les deux tables sont vides au moment de ce retrait — aucun consentement n'a
-- jamais été accordé, l'application Microsoft n'ayant pas été enregistrée.
-- Le garde-fou ci-dessous refuse la migration si ce n'est plus vrai, pour ne
-- pas détruire un jeton en cours d'usage sur un autre environnement.
do $$ begin
  if exists(select 1 from public.automation_connections) then
    raise exception 'AUTOMATION_CONNECTIONS_NOT_EMPTY: revoke the Microsoft consent before dropping';
  end if;
end $$;

drop table public.automation_oauth_states;
drop table public.automation_connections;

-- `AUTOMATION_ENCRYPTION_KEY` reste nécessaire : `contact-submit` s'en sert
-- comme sel du hachage d'adresse qui alimente la limite par email. Ce n'est
-- plus une clé de chiffrement, seulement un sel — à ne pas remplacer sans
-- accepter que les compteurs de débit repartent de zéro.
