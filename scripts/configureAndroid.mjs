/**
 * Configura el proyecto Android que genera Capacitor (`cap add android`) para el juego:
 *  - Orientación horizontal nativa desde el primer fotograma (sensorLandscape en el manifiesto + refuerzo en MainActivity):
 *    la app arranca ya en horizontal y gira entre los dos lados, nunca queda en vertical ni pide girar el teléfono.
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
  // Retorno del login OAuth (Google/Facebook) por esquema de la app:
  // com.cartasdominicanas.app://login-callback. Idempotente: si ya está,
  // no se duplica. `cap sync` no regenera el manifiesto, pero un `cap add`
  // nuevo sí: este script lo repone en cada `npm run android:sync`.
  if (!manifest.includes('login-callback')) {
    const loginFilter = `            <intent-filter>
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="com.cartasdominicanas.app" android:host="login-callback" />
            </intent-filter>`;
    manifest = manifest.replace(/(\s*)<\/activity>/, `$1${loginFilter}\n$1</activity>`);
  }
  // AdMob: ID de la app para el SDK (de prueba por ahora; al pasar a anuncios
  // reales se cambia aquí y en src/lib/ads.ts por el de la cuenta AdMob).
  // Idempotente: si ya está, no se duplica.
  if (!manifest.includes('com.google.android.gms.ads.APPLICATION_ID')) {
    const admobMeta = `        <!-- AdMob: ID de la app (de prueba por ahora; al pasar a anuncios reales
             se cambia por el de la cuenta AdMob, igual que en src/lib/ads.ts).
             Lo repone scripts/configureAndroid.mjs si el manifiesto se regenera. -->
        <meta-data
            android:name="com.google.android.gms.ads.APPLICATION_ID"
            android:value="ca-app-pub-3940256099942544~3347511713" />`;
    manifest = manifest.replace(/(\s*)<\/application>/, `\n${admobMeta}$1</application>`);
  }
  fs.writeFileSync(manifestPath, manifest);
  console.log('[configureAndroid] AndroidManifest.xml: sensorLandscape + intent-filter login-callback');
}

/* 2. styles.xml: ventana a pantalla completa desde el arranque, incluido el tema del splash (el que usa la
      actividad al abrir), para que la barra de estado y la de navegación no se vean ni un instante. */
const stylesPath = path.join(androidDir, 'app/src/main/res/values/styles.xml');
if (fs.existsSync(stylesPath)) {
  let styles = fs.readFileSync(stylesPath, 'utf8');
  const items = `
        <item name="android:windowFullscreen">true</item>
        <item name="android:statusBarColor">@android:color/transparent</item>
        <item name="android:navigationBarColor">@android:color/transparent</item>`;
  for (const theme of ['AppTheme.NoActionBar', 'AppTheme.NoActionBarLaunch']) {
    const open = new RegExp(`(<style name="${theme.replace('.', '\\.')}"[^>]*>)`);
    const block = new RegExp(`<style name="${theme.replace('.', '\\.')}"[^>]*>[\\s\\S]*?</style>`);
    const current = block.exec(styles)?.[0];
    if (current && !current.includes('android:windowFullscreen')) {
      styles = styles.replace(open, `$1${items}`);
    }
  }
  fs.writeFileSync(stylesPath, styles);
  console.log('[configureAndroid] styles.xml: windowFullscreen (tema normal y de arranque)');
}

/* 3. MainActivity: modo inmersivo, notch y pantalla encendida */
const javaDir = path.join(androidDir, 'app/src/main/java', ...appId.split('.'));
fs.mkdirSync(javaDir, { recursive: true });
const mainActivity = `package ${appId};

import android.content.pm.ActivityInfo;
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
        // Horizontal desde el primer momento (refuerza al manifiesto, también en Android que ignore el atributo).
        setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE);
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

/* 4. Verificación: si algo no quedó aplicado, la compilación falla en vez de producir un APK en vertical o con barras. */
const problems = [];
if (fs.existsSync(manifestPath) && !fs.readFileSync(manifestPath, 'utf8').includes('android:screenOrientation="sensorLandscape"')) {
  problems.push('AndroidManifest.xml sin screenOrientation="sensorLandscape"');
}
if (fs.existsSync(manifestPath) && !fs.readFileSync(manifestPath, 'utf8').includes('login-callback')) {
  problems.push('AndroidManifest.xml sin intent-filter de login-callback');
}
if (fs.existsSync(manifestPath) && !fs.readFileSync(manifestPath, 'utf8').includes('com.google.android.gms.ads.APPLICATION_ID')) {
  problems.push('AndroidManifest.xml sin APPLICATION_ID de AdMob');
}
if (!fs.readFileSync(path.join(javaDir, 'MainActivity.java'), 'utf8').includes('SCREEN_ORIENTATION_SENSOR_LANDSCAPE')) {
  problems.push('MainActivity.java sin bloqueo horizontal');
}
if (fs.existsSync(stylesPath) && !fs.readFileSync(stylesPath, 'utf8').match(/NoActionBarLaunch"[^>]*>\s*<item name="android:windowFullscreen"/)) {
  problems.push('styles.xml: el tema de arranque no es de pantalla completa');
}
if (problems.length > 0) {
  console.error('[configureAndroid] ERROR:\n - ' + problems.join('\n - '));
  process.exit(1);
}
console.log('[configureAndroid] Verificado: horizontal bloqueado y pantalla completa inmersiva.');
