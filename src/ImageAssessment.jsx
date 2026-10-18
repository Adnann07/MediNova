import { useEffect, useState } from 'react';

const apiBase = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8787/api';

export default function ImageAssessment() {
  const [query, setQuery] = useState('chest x-ray case report');
  const [cases, setCases] = useState([]);
  const [caseIndex, setCaseIndex] = useState(0);
  const [interpretation, setInterpretation] = useState('');
  const [assessment, setAssessment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const currentCase = cases[caseIndex];

  async function searchImages(searchTerm = query) {
    setLoading(true);
    setError('');
    setCases([]);
    setAssessment(null);
    setInterpretation('');
    try {
      const response = await fetch(`${apiBase}/image-assessment/search?query=${encodeURIComponent(searchTerm.trim())}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || `Open-i search failed (HTTP ${response.status}).`);
      setCases(result.cases);
      setCaseIndex(0);
    } catch (searchError) {
      setError(searchError.message || 'Could not load Open-i images.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    searchImages('chest x-ray case report');
  }, []);

  function selectImage(index) {
    setCaseIndex(index);
    setAssessment(null);
    setInterpretation('');
    setError('');
  }

  async function submitInterpretation(event) {
    event.preventDefault();
    if (!currentCase || !interpretation.trim() || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const response = await fetch(`${apiBase}/image-assessment/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseId: currentCase.id, interpretation: interpretation.trim() }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || `Could not assess this interpretation (HTTP ${response.status}).`);
      setAssessment(result);
    } catch (submitError) {
      setError(submitError.message || 'Could not generate image feedback.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="sim-app">
      <header className="sim-topbar">
        <a className="sim-brand" href="/" aria-label="MediNova home"><span className="sim-brand-mark">✚</span><span>medi<span className="brand-nova">nova</span></span></a>
        <nav className="discussion-nav" aria-label="Main navigation">
          <a href="/">Practice room</a>
          <a href="/discussion">Scientific discussion</a>
          <a href="/case-generator">Generate from PDFs</a>
          <a href="/report-assessment">Lab report</a>
          <span aria-current="page">Image assessment</span>
        </nav>
        <span className="training-chip"><span /> EDUCATION MODE</span>
      </header>

      <main className="discussion-page image-assessment-page">
        <div className="discussion-intro">
          <div>
            <div className="section-kicker">OPEN-I · GEMMA FEEDBACK</div>
            <h1>Read the image.<br /><span>Then reveal the evidence.</span></h1>
            <p>Practice describing a published medical image before comparing your interpretation with its available source information.</p>
          </div>
          <div className="discussion-safety"><strong>Training only</strong><span>Images and captions are from Open-i. This is not diagnostic software or patient care.</span></div>
        </div>

        <section className="discussion-panel image-search-panel">
          <form className="image-search-form" onSubmit={(event) => { event.preventDefault(); searchImages(); }}>
            <label htmlFor="openi-query">SEARCH OPEN-I</label>
            <input id="openi-query" value={query} onChange={(event) => setQuery(event.target.value)} maxLength={120} placeholder="e.g. chest X-ray case report" />
            <button className="primary-button" type="submit" disabled={loading || !query.trim()}>{loading ? 'Searching…' : 'Find images'}</button>
          </form>
          <small>Searches the Open-i API for published image records. Metadata is revealed after your submission.</small>
        </section>

        {error && <div className="image-assessment-error" role="alert">{error}</div>}
        {loading && <div className="image-assessment-empty">Loading medical images from Open-i…</div>}
        {!loading && currentCase && (
          <div className="image-assessment-grid">
            <section className="discussion-panel image-viewer-panel">
              <div className="image-panel-heading">
                <div><span>OPEN-I MEDICAL IMAGE</span><strong>Image {caseIndex + 1} of {cases.length}</strong></div>
                <div className="image-pager">
                  <button type="button" onClick={() => selectImage((caseIndex + cases.length - 1) % cases.length)} disabled={cases.length < 2} aria-label="Previous image">Previous</button>
                  <button type="button" onClick={() => selectImage((caseIndex + 1) % cases.length)} disabled={cases.length < 2} aria-label="Next image">Next</button>
                </div>
              </div>
              <div className="openi-image-frame">
                <img src={currentCase.imageUrl} alt="Medical image from Open-i; interpret the visible findings before revealing the published caption." />
              </div>
              <p className="image-provider-note">Image served by Open-i, U.S. National Library of Medicine. The published caption and article context are hidden until you submit.</p>
            </section>

            <section className="discussion-panel image-interpretation-panel">
              <div className="discussion-panel-heading">
                <div><span className="discussion-step">YOUR TURN</span><h2>What do you see?</h2></div>
              </div>
              <form onSubmit={submitInterpretation}>
                <label className="image-interpretation-label" htmlFor="image-interpretation">Describe the visible features and your cautious interpretation.</label>
                <textarea id="image-interpretation" value={interpretation} onChange={(event) => setInterpretation(event.target.value)} maxLength={3000} rows={8} placeholder="Write what you observe. Note uncertainty and avoid assuming findings that are not visible." />
                <div className="image-submit-row"><small>{interpretation.length}/3000</small><button className="primary-button" type="submit" disabled={submitting || !interpretation.trim()}>{submitting ? 'Reviewing…' : 'Submit interpretation'}</button></div>
              </form>
            </section>
          </div>
        )}
        {!loading && !currentCase && !error && <div className="image-assessment-empty">No Open-i images were found. Try a different search phrase.</div>}

        {assessment && (
          <section className="image-assessment-results" aria-live="polite">
            <div className="image-feedback-card">
              <div className="image-feedback-label">{assessment.feedbackLabel}</div>
              <h2>Compare with the published information</h2>
              <p className="image-feedback-text">{assessment.feedback}</p>
              <div className="image-feedback-columns">
                <div><strong>What aligns</strong>{assessment.strengths.map((item, index) => <p key={`strength-${index}`}>{item}</p>)}</div>
                <div><strong>Consider next</strong>{assessment.nextConsiderations.map((item, index) => <p key={`consideration-${index}`}>{item}</p>)}</div>
              </div>
              <div className="image-reference-card">
                <div className="section-kicker">OPEN-I REFERENCE INFORMATION</div>
                <h3>{assessment.reference.title || 'Published article title not supplied'}</h3>
                {assessment.reference.caption && <p><strong>Figure caption</strong>{assessment.reference.caption}</p>}
                {assessment.reference.clinicalInformation && <p><strong>Article context</strong>{assessment.reference.clinicalInformation}</p>}
                <div className="image-reference-links">
                  <a href={assessment.source.url} target="_blank" rel="noreferrer">Open-i service information</a>
                  {assessment.source.articleUrl && <a href={assessment.source.articleUrl} target="_blank" rel="noreferrer">Open the linked article</a>}
                  {assessment.reference.pmid && <span>PMID {assessment.reference.pmid}</span>}
                  {assessment.reference.pmcid && <span>PMCID {assessment.reference.pmcid}</span>}
                </div>
              </div>
              <p className="image-assessment-disclaimer">No structured verified reference diagnosis was supplied by the Open-i record. Gemma compared your text with the available caption and article context; it did not analyze the image pixels. Feedback is AI-generated and not a definitive grade or clinical opinion.</p>
            </div>
          </section>
        )}

        <footer className="discussion-footer"><span>Educational practice only · not for diagnosis or treatment</span><span>Image search: <a href="https://openi.nlm.nih.gov/services" target="_blank" rel="noreferrer">Open-i API services</a> · powered feedback: configured Gemma model</span></footer>
      </main>
    </div>
  );
}
