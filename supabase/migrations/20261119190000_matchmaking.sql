/*
# Matchmaking ("Jugar online") y salida de salas en espera

1. Problema
- Solo se podía entrar a una sala con su código: no había forma de jugar en
  línea con desconocidos ni de completar una mesa con bots.
- Salir de una sala en espera dejaba el asiento ocupado para siempre.

2. Cambios
- Columna `rooms.is_public`: true en las salas de matchmaking, false en las de
  código (privadas). Las salas viejas (creadas antes de esta migración) quedan
  como privadas.
- Índice para buscar salas públicas en espera por juego, de la más vieja a la
  más nueva.
- `apply_room_update(...)` ahora también guarda `is_public` (nueva firma con
  `p_is_public`; la vieja se borra). Sin esta migración, la Edge Function nueva
  falla: hay que aplicar la migración al desplegar.
- `rooms_guard`: `is_public` no se puede cambiar, y en espera se permite
  quitar un jugador (salir de la sala) además de añadir al final. Durante la
  partida la lista sigue siendo intocable.

3. Nota
- `created_at` ya existía y se usa como marca de la espera: una sala pública
  con más de 5 minutos en espera no se ofrece en matchmaking, y a los 30 s se
  completa con bots. La lógica vive en el servidor (`roomService.ts`).
*/

ALTER TABLE rooms ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS rooms_matchmaking_idx ON rooms (game, status, is_public, created_at);

DROP FUNCTION IF EXISTS apply_room_update(uuid, integer, text, jsonb, jsonb, jsonb);

CREATE OR REPLACE FUNCTION apply_room_update(
  p_room_id uuid,
  p_expected_version integer,
  p_status text,
  p_players jsonb,
  p_state jsonb,
  p_keys jsonb,
  p_is_public boolean
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated integer;
BEGIN
  UPDATE rooms
     SET status = p_status,
         players = p_players,
         version = p_expected_version + 1,
         is_public = p_is_public
   WHERE id = p_room_id
     AND version = p_expected_version;
  GET DIAGNOSTICS updated = ROW_COUNT;
  IF updated = 0 THEN
    RETURN false;
  END IF;

  UPDATE room_secrets
     SET state = p_state,
         keys = p_keys
   WHERE room_id = p_room_id;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION apply_room_update(uuid, integer, text, jsonb, jsonb, jsonb, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION apply_room_update(uuid, integer, text, jsonb, jsonb, jsonb, boolean) TO service_role;

CREATE OR REPLACE FUNCTION rooms_guard() RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.code IS DISTINCT FROM OLD.code
     OR NEW.game IS DISTINCT FROM OLD.game
     OR NEW.is_public IS DISTINCT FROM OLD.is_public
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'rooms: id, code, game, is_public y created_at no se pueden modificar';
  END IF;

  IF NEW.version IS DISTINCT FROM OLD.version + 1 THEN
    RAISE EXCEPTION 'rooms: version debe avanzar exactamente en uno';
  END IF;

  IF OLD.status = 'playing' AND NEW.status = 'waiting' THEN
    RAISE EXCEPTION 'rooms: una partida en curso no puede volver a la sala de espera';
  END IF;

  IF NEW.players IS DISTINCT FROM OLD.players THEN
    IF OLD.status = 'playing' THEN
      RAISE EXCEPTION 'rooms: no se puede cambiar la lista de jugadores durante la partida';
    END IF;
    IF jsonb_array_length(NEW.players) > jsonb_array_length(OLD.players) THEN
      -- Solo se pueden añadir jugadores al final de la lista.
      IF (SELECT jsonb_agg(t.p->'id' ORDER BY t.i)
           FROM jsonb_array_elements(NEW.players) WITH ORDINALITY AS t(p, i)
           WHERE t.i <= jsonb_array_length(OLD.players))
          IS DISTINCT FROM
          (SELECT jsonb_agg(t.p->'id' ORDER BY t.i)
           FROM jsonb_array_elements(OLD.players) WITH ORDINALITY AS t(p, i)) THEN
        RAISE EXCEPTION 'rooms: solo se pueden añadir jugadores al final de la lista';
      END IF;
    ELSIF jsonb_array_length(NEW.players) < jsonb_array_length(OLD.players) THEN
      -- Solo se puede quitar un jugador (salir de la sala): el resto conserva su identidad, sin duplicados.
      IF jsonb_array_length(NEW.players) <> jsonb_array_length(OLD.players) - 1 THEN
        RAISE EXCEPTION 'rooms: solo se puede quitar un jugador a la vez';
      END IF;
      IF (SELECT count(DISTINCT p->>'id') FROM jsonb_array_elements(NEW.players) AS p)
          <> jsonb_array_length(NEW.players)
         OR EXISTS (
           SELECT 1 FROM jsonb_array_elements(NEW.players) AS n(p)
           WHERE (n.p->>'id') NOT IN (SELECT o.p->>'id' FROM jsonb_array_elements(OLD.players) AS o(p))
         ) THEN
        RAISE EXCEPTION 'rooms: solo se pueden quitar jugadores de la lista';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
