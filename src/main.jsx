import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles/global.css';
import './styles/layout.css';
import './styles/components.css';
import App from './App.jsx';
import './styles/glassmorphism.css';
import './styles/ThemeModes.css';
/* Business Operations sidebar module — temporarily hidden in App.jsx.
   Keep this list as a reminder when restoring the feature:
   Scheduler, Bookings, Income, Expenses, Profit, Shareholders.
   Clients is grouped under G4 Sticker.
*/
createRoot(document.getElementById('root')).render(
  <React.StrictMode><App /></React.StrictMode>
);
