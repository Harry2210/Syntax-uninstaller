import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { applyAppearance, loadSettings } from './services/preferences';
import './styles/index.css';

// Restore the saved theme before the first paint so the window never flashes
// the wrong palette while React is booting.
applyAppearance(loadSettings());

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
