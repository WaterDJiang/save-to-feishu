import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import SidePanelApp from './SidePanelApp';
import './sidepanel.css';

const root = document.getElementById('root');

if (root) {
  createRoot(root).render(
    <StrictMode>
      <ErrorBoundary>
        <SidePanelApp />
      </ErrorBoundary>
    </StrictMode>
  );
}
