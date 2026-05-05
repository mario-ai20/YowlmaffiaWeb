-- Leegt alleen de publieke chatgeschiedenis.
-- Veilig om handmatig te runnen wanneer je de public chat opnieuw "nieuw" wilt starten.

delete from public.messages
where room_key = 'public'
   or scope = 'public';

delete from public.notifications
where kind = 'private_message'
  and actor_username is null;

notify pgrst, 'reload schema';
