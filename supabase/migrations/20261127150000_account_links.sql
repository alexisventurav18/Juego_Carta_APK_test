-- Cuentas reales: vínculo entre la cuenta de Supabase Auth (Google /
-- Facebook / correo) y la identidad del jugador (player_profiles).
--
-- La cuenta es la fuente de verdad para recuperar el progreso en otro
-- teléfono; la clave de dispositivo sigue siendo la credencial para las
-- acciones de sala. Un jugador tiene como mucho UNA cuenta vinculada y
-- una cuenta pertenece como mucho a UN jugador (uno a uno en ambos
-- sentidos, reforzado por las dos UNIQUE).
--
-- Sin acceso público: solo el service role (la Edge Function `rooms`)
-- lee y escribe esta tabla. Los clientes nunca la tocan directamente.
create table if not exists public.account_links (
  auth_user_id uuid primary key,
  player_id text not null unique references public.player_profiles (player_id) on delete cascade,
  provider text not null default 'google',
  provider_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

revoke all on public.account_links from anon, authenticated;

-- Al rotar la clave de un jugador (restore_account), las salas en las
-- que ya estaba también deben aceptar la clave nueva: su hash vive en
-- room_secrets.keys. Sin esto, restaurar en un teléfono nuevo dejaría al
-- jugador fuera de sus salas en espera.
create or replace function public.rotate_room_keys(p_player_id text, p_new_hash text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.room_secrets
     set keys = keys || jsonb_build_object(p_player_id, p_new_hash)
   where keys ? p_player_id;
$$;

revoke all on function public.rotate_room_keys(text, text) from anon, authenticated;
