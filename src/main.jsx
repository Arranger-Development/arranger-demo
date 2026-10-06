import { StrictMode, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import Root from './app/Root.jsx';
import './index.css';
import './app/themes/swiss.css';
import { initializeTheme } from './app/themeStore.js';

initializeTheme();

createRoot(document.getElementById('root')).render(
  createElement(StrictMode, null, createElement(Root)),
);
