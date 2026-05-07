import '@fontsource/manrope/400.css';
import '@fontsource/manrope/500.css';
import '@fontsource/manrope/600.css';
import '@fontsource/manrope/700.css';
import '@fontsource/space-grotesk/400.css';
import '@fontsource/space-grotesk/500.css';
import '@fontsource/space-grotesk/700.css';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router';
import App from './App';
import { CURRENT_WEB_BUILD_ID } from './generated/buildVersion';
import './styles/app.css';

document.title = 'YOWLMAFFIA';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.getRegistrations()
      .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
      .catch(() => {});
  });
}

if (typeof window !== 'undefined') {
  window.setInterval(() => {
    fetch(`./version.json?ts=${Date.now()}`, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache'
      }
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        const nextBuildId = String(payload?.buildId || '').trim();
        if (nextBuildId && nextBuildId !== CURRENT_WEB_BUILD_ID) {
          window.location.reload();
        }
      })
      .catch(() => {});
  }, 60000);
}

const root = createRoot(document.getElementById('root'));

root.render(
  <HashRouter>
    <App />
  </HashRouter>
);
