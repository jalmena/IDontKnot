import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './i18n.ts';
import './styles.css';
import { App } from './App.tsx';
import { RopeChoice } from './viewer/RopeChoice.tsx';

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <RopeChoice>
      <App />
    </RopeChoice>
  </StrictMode>,
);
