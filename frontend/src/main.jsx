import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './styles/torii.css';
import './styles/console.css';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter basename="/schedules">
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);