import { useState } from 'react';
import { extractPdfPages } from './pdfMaterials.js';

const apiBase = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8787/api';

function CaseGenerator() {
  const [files, setFiles] = useState([]);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [session, setSession] = useState(null);
  const [demo, setDemo] = useState(null);
  const [preparing, setPreparing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [dragging, setDragging] = useState(false);

  function chooseFiles(fileList) {
    const selected = Array.from(fileList);
    setError('');
    setDemo(null);
    setSession(null);
    setStatus('');
    if (selected.length > 3) {
      setFiles([]);
      setError('Choose no more than three PDFs at a time.');
      return;
    }
    if (selected.some((file) => !file.name.toLowerCase().endsWith('.pdf') || file.size > 15 * 1024 * 1024)) {
      setFiles([]);
      setError('Upload PDF files only. Each file must be 15 MB or smaller.');
      return;
    }
    if (selected.reduce((total, file) => total + file.size, 0) > 25 * 1024 * 1024) {
      setFiles([]);
      setError('The combined PDF size must be 25 MB or smaller.');
      return;
    }
    setFiles(selected);
  }

  async function indexMaterial() {
    if (!files.length || preparing || generating) return;
    setPreparing(true);
    setError('');
    setDemo(null);
    try {
      const pages = await extractPdfPages(files, setStatus);
      setStatus('Indexing searchable passages…');
      const response = await fetch(`${apiBase}/discussions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pages }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || `Could not index PDFs (HTTP ${response.status}).`);
      setSession(result);
      await generateCase(result.sessionId);
    } catch (indexError) {
      setStatus('');
      setError(indexError.message || 'Could not read these PDFs.');
    } finally {
      setPreparing(false);
    }
  }

  async function generateCase(sessionId) {
    if (!sessionId || generating) return;
    setGenerating(true);
    setError('');
    setDemo(null);
    setStatus('Selecting representative passages and generating a fictional case with Gemma…');
    try {
      const response = await fetch(`${apiBase}/cases/from-material`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || `Could not generate case (HTTP ${response.status}).`);
      setDemo(result);
      setStatus(`Generated from ${result.sources.length} retrieved source passages`);
    } catch (generationError) {
      setStatus('');
      setError(generationError.message || 'Could not generate a case from this material.');
    } finally {
      setGenerating(false);
    }
  }

  const sourcesById = new Map((demo?.sources || []).map((source) => [source.id, source]));
  const citationsFor = (ids) => (ids || []).map((id) => sourcesById.get(id)).filter(Boolean);
  const renderCitations = (ids) => citationsFor(ids).map((source) => (
    <a key={source.id} href={`#material-source-${source.id}`}>{source.documentName}, p. {source.pageNumber}</a>
  ));

  return (
    <div className="sim-app discussion-app">
      <header className="sim-topbar">
        <a className="sim-brand" href="/" aria-label="MediNova home"><span className="sim-brand-mark">✚</span><span>medi<span className="brand-nova">nova</span></span></a>
        <nav className="discussion-nav" aria-label="Main navigation">
          <a href="/">Practice room</a>
          <a href="/discussion">Scientific discussion</a>
          <span aria-current="page">Material case generator</span>
          <a href="/image-assessment">Image assessment</a>
          <a href="/report-assessment">Lab report</a>
        </nav>
        <span className="training-chip"><span /> EDUCATION MODE</span>
      </header>

      <main className="discussion-page">
        <div className="discussion-intro">
          <div>
            <div className="section-kicker">RAG · LOCAL PDF OCR · GEMMA</div>
            <h1>Build a case<br /><span>from your material.</span></h1>
            <p>Turn relevant excerpts into a fictional patient interview and two simulated text lab reports, with source pages attached to the generated details.</p>
          </div>
          <aside className="discussion-safety"><strong>Educational simulation only</strong><span>Generated symptoms and lab values are fictional, not validated results or clinical advice. Never upload identifiable patient records.</span></aside>
        </div>

        <div className="discussion-layout">
          <section className="discussion-workspace">
            <section className="discussion-panel upload-panel">
              <div className="discussion-panel-heading">
                <span className="setup-number">01</span>
                <div><h2>Add your learning material</h2><p>Text extraction and OCR run in your browser. Gemma selects a suitable scenario from your material and generates the patient interview and lab reports automatically.</p><p className="discussion-privacy-note">Use de-identified educational PDFs only. Extracted text is temporarily indexed in local API memory; retrieved excerpts are sent to Ollama.</p></div>
              </div>
              <label
                className={`pdf-dropzone ${files.length ? 'has-files' : ''} ${dragging ? 'is-dragging' : ''}`}
                onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={(event) => { event.preventDefault(); setDragging(false); chooseFiles(event.dataTransfer.files); }}
              >
                <input type="file" accept="application/pdf,.pdf" multiple onChange={(event) => { chooseFiles(event.target.files); event.target.value = ''; }} disabled={preparing || generating} />
                <span className="pdf-icon">PDF</span>
                <span><strong>{files.length ? `${files.length} PDF${files.length === 1 ? '' : 's'} selected` : 'Choose or drop PDF material'}</strong><small>Up to 3 PDFs · 15 MB each · 80 pages combined</small></span>
                <span className="pdf-browse">Browse files</span>
              </label>
              {files.length > 0 && <ul className="pdf-file-list">{files.map((file) => <li key={`${file.name}-${file.size}`}>{file.name}<span>{(file.size / 1024 / 1024).toFixed(1)} MB</span></li>)}</ul>}
              <div className="discussion-actions">
                <button className="primary-button" type="button" onClick={() => (session ? generateCase(session.sessionId) : indexMaterial())} disabled={!files.length || preparing || generating}>
                  {preparing ? 'Reading material & generating…' : generating ? 'Gemma is generating…' : session ? (demo ? 'Generate another case' : 'Retry case generation') : 'Extract material & generate case'}
                </button>
                {status && <span className="discussion-progress" role="status">{status}</span>}
              </div>
            </section>

            {error && <div className="discussion-error" role="alert">{error}</div>}

            {demo && (
              <section className="discussion-panel material-demo" aria-live="polite">
                <div className="discussion-panel-heading"><span className="setup-number">03</span><div><h2>{demo.case.title}</h2><p>{demo.case.category} · fictional patient · {demo.case.age} years old · {demo.case.acuity || 'practice'} scenario</p></div></div>
                <div className="material-context"><strong>Case context</strong><p>{demo.case.clinicalContext || 'A fictional learning scenario generated from your selected source passages.'}</p><small>Sources: {renderCitations(demo.case.materialCitations?.clinicalContext)}</small></div>
                <div className="material-patient"><strong>{demo.case.patient}</strong><p>“{demo.case.opening}”</p><small>Opening symptoms · {renderCitations(demo.case.materialCitations?.opening)}</small></div>
                <h3>Patient interview</h3>
                <div className="material-topic-list">{demo.case.topics.map((topic, index) => (
                  <article key={topic.id}>
                    <strong>{topic.label}</strong><p>{topic.answer}</p>
                    <small>Sources: {renderCitations(demo.case.materialCitations?.topics?.[index])}</small>
                  </article>
                ))}</div>
                <h3>Simulated lab reports</h3>
                <p className="material-report-warning">Fictional illustrative text results only. These are not real laboratory findings, validated reference ranges, or medical advice.</p>
                <div className="material-report-list">{demo.tests.map((test) => (
                  <article key={test.id}>
                    <div className="material-report-heading"><strong>{test.name}</strong><small>Sources: {renderCitations(test.sourceIds)}</small></div>
                    <dl>{test.findings.map((finding) => <div key={finding.name}><dt>{finding.name}</dt><dd>{finding.value}</dd></div>)}</dl>
                    <p>{test.summary}</p>
                  </article>
                ))}</div>
                <div className="material-context"><strong>Learning note</strong><p>{demo.case.learning}</p><small>Sources: {renderCitations(demo.case.materialCitations?.learning)}</small></div>
                <div className="discussion-actions"><a className="primary-button" href={`/?case=${encodeURIComponent(demo.case.id)}`}>Practice this case</a><span className="discussion-ready">Learner assessment remains grounded in retrieved web guidance.</span></div>
              </section>
            )}
          </section>

          {demo && <aside className="discussion-sources material-source-list">
            <div className="discussion-sources-heading"><span className="section-kicker">RAG RETRIEVAL</span><h2>Source passages</h2><p>Generated details are linked to these excerpts. Select a citation in the case to match the document and page shown.</p></div>
            {demo.sources.map((source) => (
              <article className="source-card" id={`material-source-${source.id}`} key={source.id}>
                <div className="source-card-meta"><span>{source.documentName} · p. {source.pageNumber}</span><strong>{source.id}</strong></div>
                <p>{source.text}</p>
              </article>
            ))}
          </aside>}
        </div>
        <footer className="discussion-footer"><span>“Making mistakes before it counts.”</span><span>Fictional AI-generated case · Verify against your original sources.</span></footer>
      </main>
    </div>
  );
}

export default CaseGenerator;
