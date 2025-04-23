import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './styles/index.css';

// Cibler l'élément racine (s'assurer qu'il existe dans index.html, souvent 'root')
const rootElement = document.getElementById('root');

if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
} else {
  console.error("Failed to find the root element. Make sure your index.html has an element with id='root' (or adjust the id here).");
}
