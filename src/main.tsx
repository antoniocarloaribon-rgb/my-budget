import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import { seedIfEmpty } from './lib/db';
import './index.css';

// Offline support: caches the app so it opens without internet.
registerSW({ immediate: true });

// Ask the browser to keep our data even when storage runs low.
void navigator.storage?.persist?.();

seedIfEmpty().finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
