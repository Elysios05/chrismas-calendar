-- Données « d'avant les salons » (après 0001–0003, AVANT 0004) : vérifie que 0004 ne perd rien.
\set ON_ERROR_STOP on
\set QUIET on
insert into auth.users values
  ('00000000-0000-0000-0000-00000000000a', 'alexandre@example.com'),
  ('00000000-0000-0000-0000-00000000000f', 'flavie@example.com');
insert into public.profiles values
  ('00000000-0000-0000-0000-00000000000a', 'alexandre'), ('00000000-0000-0000-0000-00000000000f', 'flavie');
insert into public.progress (who, day) values ('alexandre', 1), ('flavie', 1);
insert into public.prepared_content (day, from_who, to_who, message, photos) values (4, 'flavie', 'alexandre', 'avant', array['flavie/p.jpg']);
insert into public.game_state (day, key, value, updated_by) values (2, 'score:flavie', '7', 'flavie');
insert into public.push_subscriptions (endpoint, who, p256dh, auth) values ('https://fcm.googleapis.com/fcm/send/vieux', 'flavie', 'k', 'a');
insert into public.reminder_log (day, who, kind) values (4, 'flavie', 'rappel');
insert into storage.objects (bucket_id, name) values ('photos', 'flavie/p.jpg');
