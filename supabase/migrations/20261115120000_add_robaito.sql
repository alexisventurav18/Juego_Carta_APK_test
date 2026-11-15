/*
  # Añade El Robaíto

  1. Cambios
    - `rooms.game` pasa a aceptar: casino, tresydos, cagao, robaito (antes: casino, tresydos, cagao).

  2. Datos existentes
    - No se borra ni se modifica ninguna sala: solo se amplía la lista de juegos permitidos.

  3. Notas
    - Después de aplicar esta migración hay que volver a desplegar la Edge Function `rooms`
      (supabase functions deploy rooms), porque su copia del motor ahora incluye El Robaíto.
*/

ALTER TABLE rooms DROP CONSTRAINT IF EXISTS rooms_game_check;

ALTER TABLE rooms
  ADD CONSTRAINT rooms_game_check CHECK (game IN ('casino', 'tresydos', 'cagao', 'robaito'));
