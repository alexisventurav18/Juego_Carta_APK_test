# Generar el APK (Capacitor)

El proyecto ya trae Capacitor configurado (`capacitor.config.ts`, iconos en `resources/`).
No hace falta tocar el código del juego.

## Antes de empezar: clave de Supabase

El modo online necesita `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` **en el momento de compilar**.
Crea un archivo `.env` (copia de `.env.example`) con tu clave anon. Sin ella el APK abre,
y el modo contra bots offline funciona, pero crear/unirse a salas online dará error.

## Opción A: en tu PC (Node 20+, Java 21 y Android Studio)

```bash
npm install
npm run android:add      # solo la primera vez, crea la carpeta android/
npm run android:assets   # genera iconos y splash desde resources/
npm run android:apk      # compila la web, sincroniza y arma el APK
```

El APK queda en `android/app/build/outputs/apk/debug/app-debug.apk`.
Para abrirlo en Android Studio: `npm run android:open`.

## Opción B: sin instalar nada (GitHub Actions)

1. Sube el proyecto a un repositorio de GitHub.
2. En Settings > Secrets and variables > Actions agrega `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
3. Pestaña Actions > "Compilar APK Android" > Run workflow.
4. Al terminar, descarga el APK desde "Artifacts".

## Notas

- Ese APK es de depuración: sirve para instalar y probar directamente en el teléfono.
  Para publicar en Google Play necesitas un AAB firmado (`./gradlew bundleRelease` + tu keystore).
- Cada vez que cambies el código web: `npm run android:sync`.
- Orientación: la app ya queda fija en horizontal (ver "Pantalla completa, horizontal y notch").

## Opción C: WebIntoApp u otro empaquetador de zip

Esos servicios necesitan la web **compilada**, no el código fuente.

1. Con el `.env` ya completado: `npm install` y `npm run build`.
2. Se crea la carpeta `dist/`. Comprime **el contenido** de `dist/` (que `index.html` quede en la raíz del zip, no dentro de una subcarpeta).
3. Sube ese zip al servicio.

---

## Pantalla completa, horizontal y notch (v12)

- **APK (Capacitor):** `scripts/configureAndroid.mjs` deja el proyecto Android en horizontal (`sensorLandscape` en el
  manifiesto y `setRequestedOrientation` en `MainActivity`, así arranca ya en horizontal), con barras ocultas (inmersivo,
  también en el tema de arranque/splash), contenido bajo el notch y pantalla siempre encendida. Se ejecuta solo en `npm run android:add`,
  `npm run android:sync` y en el workflow de GitHub Actions. Si ya tienes la carpeta `android/`, basta con
  `npm run android:configure` y volver a compilar.
- **Navegador / WebIntoApp / PC:** `public/manifest.webmanifest` pide `fullscreen` + `landscape`. En móviles se entra a
  pantalla completa con el primer toque; en PC hay un botón de pantalla completa en el menú (o F11). Ya no existe la pantalla
  "Gira tu dispositivo": la orientación la resuelve el sistema (APK) o el manifest de la PWA.
- **Márgenes seguros:** `index.css` define `--sat/--sar/--sab/--sal`. El marco de madera y los fondos llegan a los bordes
  físicos de la pantalla (sin franjas negras); solo los botones, cartas y textos se separan lo justo del notch.

## Mesa y controles unificados

- `components/table/TableLayout.tsx` es la mesa de El Cagao hecha componente. Los tres juegos la usan.
- `HandFan` (mano en abanico) es la misma en los tres: pasar el ratón/dedo eleva la carta, tocar o hacer clic la elige o
  activa, arrastrar la lleva a la mesa. Casino: arrastrar a un espacio vacío tira la carta; soltarla sobre una carta o
  combinación de la mesa intenta capturarla. Tres y Dos: arrastrar al centro bota la carta al Pozo.
- Reparto, vuelos de cartas (`useFlights`, `useDealFlights`) y sonidos son los de El Cagao en todos los modos.
- El interruptor de sonido es global (menú y mesas) y se recuerda entre sesiones.

## Probar antes de compilar

```bash
npm install
npm run typecheck && npm test && npm run build
```

## Interfaz (v12)

- **Colores de equipo (Casino):** `components/table/teamColors.ts`. "Nosotros" = celeste y "Ellos" = coral. Se ven en el
  marcador, en las placas de los jugadores, en el halo y la insignia de cada Par/Suma de la mesa (según quién lo formó) y
  en el aviso de captura. Tres y Dos y El Cagao se juegan sin parejas, así que no usan colores de equipo.
- **Marcador:** las tarjetas de puntos van en la barra superior de la mesa del Casino, a los lados del compañero.
- **Aviso de instrucciones:** `components/table/useStartHint.ts`. Sale solo al empezar la partida y desaparece cuando
  termina tu primer turno (en Casino, Tres y Dos y El Cagao).
