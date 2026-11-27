import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '@xyflow/react/dist/style.css';
import './estilos.css';
import './tema.js'; // registra el tema de los gráficos una sola vez
import { ProveedorApp } from './contexto.jsx';
import App from './App.jsx';

createRoot(document.getElementById('raiz')).render(
  <StrictMode>
    <BrowserRouter>
      <ProveedorApp>
        <App />
      </ProveedorApp>
    </BrowserRouter>
  </StrictMode>,
);
