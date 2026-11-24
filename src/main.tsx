import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { installNativeShell } from './lib/nativeShell';
import { installBackgroundMusic } from './lib/music';
import { installImmersiveBoot } from './lib/platform';
import './index.css';
import './motion.css';

installNativeShell();
installImmersiveBoot();
installBackgroundMusic();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
