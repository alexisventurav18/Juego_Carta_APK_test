import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { installNativeShell } from './lib/nativeShell';
import { installImmersiveBoot } from './lib/platform';
import './index.css';

installNativeShell();
installImmersiveBoot();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
