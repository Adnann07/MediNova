import { lazy, Suspense } from 'react';
import TrainingRoom from './TrainingRoom.jsx';

const ScientificDiscussion = lazy(() => import('./ScientificDiscussion.jsx'));

export default function App() {
  if (window.location.pathname === '/discussion') {
    return <Suspense fallback={<main className="case-loading"><h1>Opening document workspace…</h1></main>}><ScientificDiscussion /></Suspense>;
  }
  return <TrainingRoom />;
}
