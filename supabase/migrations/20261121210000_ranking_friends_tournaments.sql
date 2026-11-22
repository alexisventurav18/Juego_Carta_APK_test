/*
# Ranking, amigos y torneos

1. Problema
- No había ninguna progresión visible entre jugadores: las monedas, el XP y
  las misiones viven solo en el teléfono de cada uno.
- No había forma de agregar amigos ni de invitarlos directo a una sala.
- No había competición más allá de la partida: ni tabla de posiciones ni
  torneos con premios.

2. Cambios
- `player_profiles`: un perfil por jugador (id + hash de su clave). La clave
  protege la identidad: el servidor rechaza crear o entrar con un id que ya
  tiene perfil con otra clave. El código de amigo (6 caracteres, sin 0/O/1/I)
  es único y es como se buscan los jugadores.
- `rankings`: puntos por temporada ('YYYY-MM' en America/Santo_Domingo) y
  juego (`game`: 'casino' | 'tresydos' | 'cagao' | 'robaito' | 'all').
  Cada partida suma en su juego y en 'all', así las pestañas por modo y la
  tabla global leen la misma tabla con otro filtro.
  Los puntos los otorga el servidor al terminar una partida (ver
  `apply_ranking_award`); el cliente nunca escribe aquí.
- `ranking_awards` / `tournament_awards`: una fila por partida premiada.
  La clave es (sala, versión): una sala se reutiliza para la revancha, así
  que solo el id de sala premiaría la primera partida y dejaría fuera las
  demás. La versión es la de la partida terminada, que no cambia hasta que
  empieza otra, así que la misma partida nunca suma dos veces.
- `friendships`: solicitudes pendientes y aceptadas (una fila por pareja, con
  quién la pidió). `room_invites`: invitación a una sala privada.
- `tournaments` / `tournament_entries`: un torneo por fin de semana
  (sábado 00:00 a domingo 23:59 en Santo Domingo), con el juego rotando por
  semana ISO. Los puntos se otorgan con `apply_tournament_award`, solo si la
  partida es del juego del torneo y terminó dentro de su ventana.
- `season_prize_claims` / `tournament_prize_claims`: un reclamo por jugador
  y podio (top 3, 500/300/150 monedas). El cliente suma las monedas al
  reclamar; el servidor solo valida el puesto y que no se haya reclamado.
- Funciones `apply_ranking_award`, `apply_tournament_award`,
  `ranking_position` y `tournament_position`: la Edge Function las llama por
  RPC porque los contadores se actualizan con incrementos atómicos (un
  upsert normal desde el cliente de Supabase no puede hacer `puntos + N`).

3. Seguridad
- Solo la Edge Function (service_role) escribe estas tablas. RLS activado
  sin políticas para anon/authenticated: el navegador nunca las toca directo,
  todo pasa por la Edge Function `rooms`.
- Los premios no se guardan como monedas en el servidor: las monedas siguen
  siendo locales. El reclamo solo registra que ese jugador ya cobró ese podio.
*/

CREATE TABLE IF NOT EXISTS player_profiles (
  player_id text PRIMARY KEY,
  name text NOT NULL,
  avatar text,
  level integer CHECK (level IS NULL OR (level >= 1 AND level <= 100)),
  key_hash text NOT NULL,
  friend_code text NOT NULL UNIQUE,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rankings (
  player_id text NOT NULL,
  season text NOT NULL,
  game text NOT NULL DEFAULT 'all',
  name text NOT NULL,
  avatar text,
  level integer,
  points integer NOT NULL DEFAULT 0,
  wins integer NOT NULL DEFAULT 0,
  losses integer NOT NULL DEFAULT 0,
  matches integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (player_id, season, game)
);
CREATE INDEX IF NOT EXISTS rankings_season_game_points_idx ON rankings (season, game, points DESC, wins DESC, player_id ASC);

CREATE TABLE IF NOT EXISTS ranking_awards (
  room_id text NOT NULL,
  match_version integer NOT NULL,
  season text NOT NULL,
  awarded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (room_id, match_version)
);

CREATE TABLE IF NOT EXISTS friendships (
  requester_id text NOT NULL,
  addressee_id text NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'accepted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (requester_id, addressee_id)
);
CREATE INDEX IF NOT EXISTS friendships_addressee_idx ON friendships (addressee_id, status);

CREATE TABLE IF NOT EXISTS room_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_id text NOT NULL,
  to_id text NOT NULL,
  code text NOT NULL,
  game text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS room_invites_to_idx ON room_invites (to_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS tournaments (
  id text PRIMARY KEY,
  game text NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  status text NOT NULL CHECK (status IN ('upcoming', 'active', 'finished'))
);

CREATE TABLE IF NOT EXISTS tournament_entries (
  tournament_id text NOT NULL,
  player_id text NOT NULL,
  name text NOT NULL,
  avatar text,
  level integer,
  points integer NOT NULL DEFAULT 0,
  wins integer NOT NULL DEFAULT 0,
  matches integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tournament_id, player_id)
);
CREATE INDEX IF NOT EXISTS tournament_entries_points_idx ON tournament_entries (tournament_id, points DESC, wins DESC, player_id ASC);

CREATE TABLE IF NOT EXISTS tournament_awards (
  room_id text NOT NULL,
  match_version integer NOT NULL,
  tournament_id text NOT NULL,
  awarded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (room_id, match_version)
);

CREATE TABLE IF NOT EXISTS season_prize_claims (
  season text NOT NULL,
  player_id text NOT NULL,
  place integer NOT NULL CHECK (place >= 1 AND place <= 3),
  coins integer NOT NULL,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (season, player_id)
);

CREATE TABLE IF NOT EXISTS tournament_prize_claims (
  tournament_id text NOT NULL,
  player_id text NOT NULL,
  place integer NOT NULL CHECK (place >= 1 AND place <= 3),
  coins integer NOT NULL,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tournament_id, player_id)
);

ALTER TABLE player_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE rankings ENABLE ROW LEVEL SECURITY;
ALTER TABLE ranking_awards ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_awards ENABLE ROW LEVEL SECURITY;
ALTER TABLE season_prize_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_prize_claims ENABLE ROW LEVEL SECURITY;

-- Otorga los puntos de una partida al ranking de la temporada. Devuelve
-- false si esa partida ya se premió. `p_results` es un arreglo JSON con
-- {player_id, name, avatar, level, points, outcome} ('win' | 'tie' | 'loss').
CREATE OR REPLACE FUNCTION apply_ranking_award(
  p_room_id text,
  p_match_version integer,
  p_season text,
  p_game text,
  p_results jsonb
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r jsonb;
  g text;
  inserted_count integer;
BEGIN
  INSERT INTO ranking_awards (room_id, match_version, season)
  VALUES (p_room_id, p_match_version, p_season)
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  IF inserted_count = 0 THEN
    RETURN false;
  END IF;

  -- Cada partida suma en su juego y en el total ('all'): las pestañas por
  -- modo y la tabla global leen la misma tabla con otro filtro.
  FOR r IN SELECT * FROM jsonb_array_elements(p_results) LOOP
    FOREACH g IN ARRAY ARRAY[p_game, 'all'] LOOP
      IF g = 'all' AND p_game = 'all' THEN
        CONTINUE;
      END IF;
      INSERT INTO rankings (player_id, season, game, name, avatar, level, points, wins, losses, matches, updated_at)
      VALUES (
        r->>'player_id',
        p_season,
        g,
        r->>'name',
        r->>'avatar',
        (r->>'level')::integer,
        (r->>'points')::integer,
        CASE WHEN r->>'outcome' = 'win' THEN 1 ELSE 0 END,
        CASE WHEN r->>'outcome' = 'loss' THEN 1 ELSE 0 END,
        1,
        now()
      )
      ON CONFLICT (player_id, season, game) DO UPDATE SET
        name = EXCLUDED.name,
        avatar = EXCLUDED.avatar,
        level = EXCLUDED.level,
        points = rankings.points + EXCLUDED.points,
        wins = rankings.wins + EXCLUDED.wins,
        losses = rankings.losses + EXCLUDED.losses,
        matches = rankings.matches + 1,
        updated_at = now();
    END LOOP;
  END LOOP;
  RETURN true;
END;
$$;

-- Igual que `apply_ranking_award`, para la tabla del torneo vigente.
CREATE OR REPLACE FUNCTION apply_tournament_award(
  p_room_id text,
  p_match_version integer,
  p_tournament_id text,
  p_results jsonb
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r jsonb;
  inserted_count integer;
BEGIN
  INSERT INTO tournament_awards (room_id, match_version, tournament_id)
  VALUES (p_room_id, p_match_version, p_tournament_id)
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  IF inserted_count = 0 THEN
    RETURN false;
  END IF;

  FOR r IN SELECT * FROM jsonb_array_elements(p_results) LOOP
    INSERT INTO tournament_entries (tournament_id, player_id, name, avatar, level, points, wins, matches, updated_at)
    VALUES (
      p_tournament_id,
      r->>'player_id',
      r->>'name',
      r->>'avatar',
      (r->>'level')::integer,
      (r->>'points')::integer,
      CASE WHEN r->>'outcome' = 'win' THEN 1 ELSE 0 END,
      1,
      now()
    )
    ON CONFLICT (tournament_id, player_id) DO UPDATE SET
      name = EXCLUDED.name,
      avatar = EXCLUDED.avatar,
      level = EXCLUDED.level,
      points = tournament_entries.points + EXCLUDED.points,
      wins = tournament_entries.wins + EXCLUDED.wins,
      matches = tournament_entries.matches + 1,
      updated_at = now();
  END LOOP;
  RETURN true;
END;
$$;

-- Posición (1 = primero) de un jugador en el ranking de una temporada y un
-- juego ('all' = todos los modos), con el mismo desempate que la tabla:
-- puntos, victorias y luego id. Null si no jugó.
CREATE OR REPLACE FUNCTION ranking_position(p_season text, p_game text, p_player_id text) RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH me AS (
    SELECT points, wins FROM rankings WHERE season = p_season AND game = p_game AND player_id = p_player_id
  )
  SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM me) THEN NULL
    ELSE (
      SELECT count(*)::integer + 1
      FROM rankings, me
      WHERE rankings.season = p_season
        AND rankings.game = p_game
        AND (
          rankings.points > me.points
          OR (rankings.points = me.points AND rankings.wins > me.wins)
          OR (rankings.points = me.points AND rankings.wins = me.wins AND rankings.player_id < p_player_id)
        )
    )
  END;
$$;

-- Igual que `ranking_position`, para un torneo.
CREATE OR REPLACE FUNCTION tournament_position(p_tournament_id text, p_player_id text) RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH me AS (
    SELECT points, wins FROM tournament_entries WHERE tournament_id = p_tournament_id AND player_id = p_player_id
  )
  SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM me) THEN NULL
    ELSE (
      SELECT count(*)::integer + 1
      FROM tournament_entries, me
      WHERE tournament_entries.tournament_id = p_tournament_id
        AND (
          tournament_entries.points > me.points
          OR (tournament_entries.points = me.points AND tournament_entries.wins > me.wins)
          OR (tournament_entries.points = me.points AND tournament_entries.wins = me.wins AND tournament_entries.player_id < p_player_id)
        )
    )
  END;
$$;

REVOKE ALL ON FUNCTION apply_ranking_award(text, integer, text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION apply_ranking_award(text, integer, text, text, jsonb) TO service_role;
REVOKE ALL ON FUNCTION apply_tournament_award(text, integer, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION apply_tournament_award(text, integer, text, jsonb) TO service_role;
REVOKE ALL ON FUNCTION ranking_position(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION ranking_position(text, text, text) TO service_role;
REVOKE ALL ON FUNCTION tournament_position(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION tournament_position(text, text) TO service_role;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20261121210000', 'ranking_friends_tournaments')
ON CONFLICT DO NOTHING;
