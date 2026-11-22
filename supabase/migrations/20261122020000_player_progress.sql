-- Respaldo del progreso en la nube (A+B): una foto por jugador con su
-- economía completa (monedas, XP, victorias, cosméticos, misiones,
-- `awarded[]` y `lastDailyDate`) y los temas equipados.
--
-- El servidor NO es autoridad de monedas ni de XP: solo guarda la foto
-- que manda el teléfono. La foto se pisa por `updated_at` (gana la copia
-- más reciente); el control de conflicto vive en el servidor de salas
-- (`save_progress` en src/games/progress.ts), no aquí.
--
-- Como el resto de tablas del juego, RLS está activo sin políticas: solo
-- el service_role (la Edge Function `rooms`) lee y escribe. El jugador
-- nunca toca esta tabla directamente; se autentica con su playerKey
-- secreta a través de `authenticateProfile`.

create table if not exists player_progress (
  player_id text primary key,
  economy jsonb not null,
  updated_at timestamptz not null default now()
);

alter table player_progress enable row level security;

insert into supabase_migrations.schema_migrations (version, name)
values ('20261122020000', 'player_progress')
on conflict do nothing;
