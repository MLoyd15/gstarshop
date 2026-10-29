import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles/global.css';
import './styles/controls.css';
import './styles/dialogs.css';
import './styles/typography.css';
import './styles/layout.css';
import './styles/components.css';
import App from './App.jsx';
import AuthProvider from './components/auth/AuthProvider.jsx';
import './styles/AuthPage.css';
import './styles/glassmorphism.css';
import './styles/ThemeModes.css';
import './styles/colorOverrides.css';
/* Finance links for Income and Expenses are visible in App.jsx.
   Scheduler, Profit, Shareholders, and Excel Sheet remain hidden.
*/
createRoot(document.getElementById('root')).render(
  <React.StrictMode><AuthProvider><App /></AuthProvider></React.StrictMode>
);

