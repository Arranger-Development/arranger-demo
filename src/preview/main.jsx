import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { initializeTheme } from '../app/themeStore.js';
import HumPreview from './HumPreview.jsx';
import '../index.css';
import '../app/themes/swiss.css';

initializeTheme();
createRoot(document.getElementById('root')).render(createElement(HumPreview));
