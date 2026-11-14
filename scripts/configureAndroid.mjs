/**
 * Configura el proyecto Android que genera Capacitor (`cap add android`) para el juego:
 *  - Orientación bloqueada en horizontal (sensorLandscape: gira entre los dos lados, nunca vertical).
 *  - Pantalla completa inmersiva real: barra de estado y de navegación ocultas (se ven un instante al deslizar
 *    desde el borde y vuelven a esconderse solas).
 *  - El contenido se dibuja también bajo el notch / recorte de cámara; la web lo respeta con `env(safe-area-inset-*)`.
 *  - La pantalla no se apaga mientras juegas.
 *
 * Es idempotente: se puede ejecutar cuantas veces haga falta (después de `cap add` y de cada `cap sync`).
 * La carpeta `android/` se vuelve a crear en cada compilación de GitHub Actions, por eso esto es un script
 * y no archivos editados a mano.
 */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const androidDir = path.join(root, 'android');

if (!fs.existsSync(androidDir)) {
  console.log('[configureAndroid] No existe la carpeta android/. Ejecuta primero: npm run android:add');
  process.exit(0);
}

const config = fs.readFileSync(path.join(root, 'capacitor.config.ts'), 'utf8');
const appId = /appId:\s*['"]([^'"]+)['"]/.exec(config)?.[1];
if (!appId) {
  console.error('[configureAndroid] No encontré appId en capacitor.config.ts');
  process.exit(1);
}

/* 1. AndroidManifest.xml: orientación horizontal */
const manifestPath = path.join(androidDir, 'app/src/main/AndroidManifest.xml');
if (fs.existsSync(manifestPath)) {
  let manifest = fs.readFileSync(manifestPath, 'utf8');
  manifest = manifest.replace(/<activity\b[^>]*>/s, (tag) => {
    const clean = tag.replace(/\s+android:screenOrientation="[^"]*"/, '');
    return clean.replace(/>$/, '\n            android:screenOrientation="sensorLandscape">');
  });
  fs.writeFileSync(manifestPath, manifest);
  console.log('[configureAndroid] AndroidManifest.xml: sensorLandscape');
}

/* 2. styles.xml: ventana a pantalla completa desde el arranque (sin parpadeo de la barra de estado) */
const stylesPath = path.join(androidDir, 'app/src/main/res/values/styles.xml');
if (fs.existsSync(stylesPath)) {
  let styles = fs.readFileSync(stylesPath, 'utf8');
  if (!styles.includes('android:windowFullscreen')) {
    styles = styles.replace(
      /(<style name="AppTheme\.NoActionBar"[^>]*>)/,
      '$1\n        <item name="android:windowFullscreen">true</item>',
    );
    fs.writeFileSync(stylesPath, styles);
  }
  console.log('[configureAndroid] styles.xml: windowFullscreen');
}

/* 3. MainActivity: modo inmersivo, notch y pantalla encendida */
const javaDir = path.join(androidDir, 'app/src/main/java', ...appId.split('.'));
fs.mkdirSync(javaDir, { recursive: true });
const mainActivity = `package ${appId};

import android.os.Build;
import android.os.Bundle;
import android.view.Window;
import android.view.WindowManager;

import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

/** Pantalla completa inmersiva, contenido bajo el notch y pantalla siempre encendida (generado por scripts/configureAndroid.mjs). */
public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Window window = getWindow();

        // El contenido se dibuja bajo las barras y el recorte de cámara; la web usa env(safe-area-inset-*).
        WindowCompat.setDecorFitsSystemWindows(window, false);
        if (Build.VERSION.SDK_INT >= 28) {
            WindowManager.LayoutParams params = window.getAttributes();
            params.layoutInDisplayCutoutMode = Build.VERSION.SDK_INT >= 30
                ? WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS
                : WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            window.setAttributes(params);
        }
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        hideSystemBars();
    }

    @Override
    public void onResume() {
        super.onResume();
        hideSystemBars();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemBars();
    }

    private void hideSystemBars() {
        Window window = getWindow();
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(window, window.getDecorView());
        controller.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        controller.hide(WindowInsetsCompat.Type.systemBars());
    }
}
`;
fs.writeFileSync(path.join(javaDir, 'MainActivity.java'), mainActivity);
console.log('[configureAndroid] MainActivity.java: modo inmersivo');
