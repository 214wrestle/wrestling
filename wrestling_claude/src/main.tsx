import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import './ui/styles.css';

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root');

if (import.meta.env.DEV && new URLSearchParams(location.search).has('lab')) {
  // Development-only review tool for bodies, poses and moves.
  void import('./lab/Lab').then((m) => m.startLab(container));
} else {
  createRoot(container).render(<App />);
}
