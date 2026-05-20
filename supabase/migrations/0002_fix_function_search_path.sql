-- Corrige el aviso de seguridad: fijar search_path en la función del trigger
create or replace function public.touch_conversation_last_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.conversations
    set last_message_at = new.created_at
    where id = new.conversation_id;
  return new;
end;
$$;
