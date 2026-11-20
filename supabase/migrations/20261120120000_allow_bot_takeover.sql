/*
 * 20261120120000_allow_bot_takeover.sql
 *
 * La acción `abandon` (salir a mitad de partida) sustituye al jugador que
 * sale por un bot en su mismo asiento, para que la partida continúe. Pero el
 * `rooms_guard` anterior prohibía CUALQUIER cambio en la lista de jugadores
 * durante la partida, así que `apply_room_update` rechazaba el abandono y la
 * Edge Function devolvía "Error interno del servidor". En la práctica,
 * abandonar a mitad de partida nunca funcionó contra la base de datos real
 * (en los tests en memoria, que no tienen el trigger, sí pasaba).
 *
 * Esta migración afloja el candado solo para ese caso: durante la partida se
 * permite cambiar la lista si y solo si es exactamente una sustitución
 * humano -> bot, en el mismo asiento y con el mismo número de jugadores.
 * Cualquier otro cambio durante la partida sigue prohibido.
 */
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
      -- Sustitución por bot al abandonar: mismo largo, un solo asiento cambia
      -- y es de humano (id sin prefijo bot-) a bot (id bot-...). Cualquier
      -- otro cambio durante la partida sigue prohibido.
      IF jsonb_array_length(NEW.players) <> jsonb_array_length(OLD.players)
         OR (SELECT count(*) FROM (
                SELECT o.i
                  FROM jsonb_array_elements(OLD.players) WITH ORDINALITY AS o(p, i)
                  JOIN jsonb_array_elements(NEW.players) WITH ORDINALITY AS n(p, i)
                    ON n.i = o.i
                 WHERE o.p->>'id' IS DISTINCT FROM n.p->>'id'
              ) diffs) <> 1
         OR NOT EXISTS (
                SELECT 1
                  FROM jsonb_array_elements(OLD.players) WITH ORDINALITY AS o(p, i)
                  JOIN jsonb_array_elements(NEW.players) WITH ORDINALITY AS n(p, i)
                    ON n.i = o.i
                 WHERE o.p->>'id' IS DISTINCT FROM n.p->>'id'
                   AND o.p->>'id' NOT LIKE 'bot-%'
                   AND n.p->>'id' LIKE 'bot-%'
              ) THEN
        RAISE EXCEPTION 'rooms: no se puede cambiar la lista de jugadores durante la partida';
      END IF;
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

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20261120120000', 'allow_bot_takeover')
ON CONFLICT DO NOTHING;
