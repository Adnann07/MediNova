import { lazy, Suspense } from 'react';
import TrainingRoom from './TrainingRoom.jsx';

const ScientificDiscussion = lazy(() => import('./ScientificDiscussion.jsx'));
const CaseGenerator = lazy(() => import('./CaseGenerator.jsx'));
const ImageAssessment = lazy(() => import('./ImageAssessment.jsx'));
const ReportAssessment = lazy(() => import('./ReportAssessment.jsx'));

export default function App() {
  if (window.location.pathname === '/discussion') {
    return <Suspense fallback={<main className="case-loading"><h1>Opening document workspace…</h1></main>}><ScientificDiscussion /></Suspense>;
  }
  if (window.location.pathname === '/case-generator') {
    return <Suspense fallback={<main className="case-loading"><h1>Opening case generator…</h1></main>}><CaseGenerator /></Suspense>;
  }
  if (window.location.pathname === '/image-assessment') {
    return <Suspense fallback={<main className="case-loading"><h1>Opening image assessment…</h1></main>}><ImageAssessment /></Suspense>;
  }
  if (window.location.pathname === '/report-assessment') {
    return <Suspense fallback={<main className="case-loading"><h1>Opening report assessment…</h1></main>}><ReportAssessment /></Suspense>;
  }
  return <TrainingRoom />;
}
