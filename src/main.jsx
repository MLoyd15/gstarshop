import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles/global.css';
import './styles/layout.css';
import './styles/components.css';
import App from './App.jsx';
createRoot(document.getElementById('root')).render(
  <React.StrictMode><App /></React.StrictMode>
);
