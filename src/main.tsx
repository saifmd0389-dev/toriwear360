import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { CustomerAuthProvider } from './context/CustomerAuthContext.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <CustomerAuthProvider>
        <App />
      </CustomerAuthProvider>
    </ErrorBoundary>
  </StrictMode>,
);
