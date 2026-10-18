import { useEffect, useState } from 'react';

const apiBase = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8787/api';

export default function ReportAssessment() {
  const [sample, setSample] = useState(null);
  const [interpretation, setInterpretation] = useState('');
  const [assessment, setAssessment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function loadSample() {
    setLoading(true);
    setError('');
    setSample(null);
    setAssessment(null);
    setInterpretation('');
    try {
      const response = await fetch(`${apiBase}/report-assessment/sample`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || `FHIR sample load failed (HTTP ${response.status}).`);
      setSample(result);
    } catch (loadError) {
      setError(loadError.message || 'Could not load the FHIR laboratory report.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSample();
  }, []);

  async function submitInterpretation(event) {
    event.preventDefault();
    if (!sample?.sessionId || !interpretation.trim() || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const response = await fetch(`${apiBase}/report-assessment/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: sample.sessionId, interpretation: interpretation.trim() }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || `Could not assess this interpretation (HTTP ${response.status}).`);
      setAssessment(result);
    } catch (submitError) {
      setError(submitError.message || 'Could not generate report feedback.');
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
          <a href="/image-assessment">Image assessment</a>
          <span aria-current="page">Lab report assessment</span>
        </nav>
        <span className="training-chip"><span /> EDUCATION MODE</span>
      </header>

      <main className="discussion-page report-assessment-page">
        <div className="discussion-intro">
          <div>
            <div className="section-kicker">HL7 FHIR · CBC · AI FEEDBACK</div>
            <h1>Interpret the report.<br /><span>Then review the evidence.</span></h1>
            <p>Practice with a published FHIR laboratory example. Compare your interpretation with the report information after you submit.</p>
          </div>
          <div className="discussion-safety"><strong>Training only</strong><span>FHIR sample data is not a real patient result or a basis for diagnosis or treatment.</span></div>
        </div>

        {error && <div className="image-assessment-error" role="alert">{error}</div>}
        {loading && <div className="image-assessment-empty">Loading the official HL7 FHIR laboratory example…</div>}
        {!loading && !sample && !error && <div className="image-assessment-empty">No sample report is available.</div>}

        {sample && (
          <>
            <section className="discussion-panel fhir-report-panel">
              <div className="fhir-report-heading">
                <div>
                  <span>{sample.source.type === 'official' ? 'OFFICIAL FHIR EXAMPLE' : 'DOCUMENTED LOCAL FALLBACK'}</span>
                  <h2>{sample.report.title}</h2>
                  <p>{sample.report.panel}</p>
                </div>
                <span className="fhir-status">Status: {sample.report.status}</span>
              </div>
              <div className="fhir-table-scroll">
                <table className="fhir-lab-table">
                  <thead><tr><th>Laboratory test</th><th>Value</th><th>Reference range</th></tr></thead>
                  <tbody>
                    {sample.report.observations.map((observation, index) => (
                      <tr key={`${observation.name}-${index}`}>
                        <th scope="row">{observation.name}</th>
                        <td>{observation.value} {observation.unit}</td>
                        <td>{observation.referenceRanges.length ? observation.referenceRanges.join('; ') : 'Not supplied'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="fhir-report-source">
                <span>FHIR sample source: <a href={sample.source.url} target="_blank" rel="noreferrer">{sample.source.title}</a></span>
                {sample.source.type === 'local-fallback' && <span>The public example could not be loaded; these values are from the documented local copy.</span>}
              </div>
            </section>

            <section className="discussion-panel fhir-interpretation-panel">
              <div className="discussion-panel-heading"><div><span className="discussion-step">YOUR TURN</span><h2>How would you interpret these results?</h2></div></div>
              <form onSubmit={submitInterpretation}>
                <label className="image-interpretation-label" htmlFor="fhir-interpretation">Summarize notable results, compare with the supplied ranges, and state what the report does or does not establish.</label>
                <textarea id="fhir-interpretation" value={interpretation} onChange={(event) => setInterpretation(event.target.value)} maxLength={3000} rows={5} placeholder="Write a cautious interpretation of the laboratory values…" />
                <div className="image-submit-row"><small>{interpretation.length}/3000</small><button className="primary-button" type="submit" disabled={submitting || !interpretation.trim()}>{submitting ? 'Reviewing…' : 'Submit interpretation'}</button></div>
              </form>
            </section>
          </>
        )}

        {assessment && (
          <section className="image-assessment-results" aria-live="polite">
            <div className="image-feedback-card">
              <div className="image-feedback-label">{assessment.feedbackLabel}</div>
              <h2>Report interpretation feedback</h2>
              <p className="fhir-model-note">Feedback provider: {assessment.provider}</p>
              {assessment.verifiedInterpretation
                ? <div className="fhir-reference-interpretation"><strong>FHIR-provided reference interpretation</strong><p>{assessment.verifiedInterpretation.type}: {assessment.verifiedInterpretation.text}</p></div>
                : <div className="fhir-reference-interpretation fhir-no-interpretation"><strong>No verified report interpretation supplied</strong><p>The DiagnosticReport example has no conclusion or Observation interpretation codes. The following feedback is AI-generated educational feedback, not a reference diagnosis.</p></div>}
              <p className="image-feedback-text">{assessment.feedback}</p>
              <div className="image-feedback-columns">
                <div><strong>What aligns</strong>{assessment.strengths.map((item, index) => <p key={`strength-${index}`}>{item}</p>)}</div>
                <div><strong>Consider next</strong>{assessment.nextConsiderations.map((item, index) => <p key={`consideration-${index}`}>{item}</p>)}</div>
              </div>
              <div className="image-reference-links"><a href={assessment.source.url} target="_blank" rel="noreferrer">Open official HL7 example</a></div>
              <p className="image-assessment-disclaimer">Educational simulation only. This feedback does not diagnose a patient or recommend treatment.</p>
            </div>
          </section>
        )}

        <footer className="discussion-footer"><span>Educational practice only · not for diagnosis or treatment</span><span>Source: <a href="https://hl7.org/fhir/diagnosticreport-examples.html" target="_blank" rel="noreferrer">HL7 FHIR DiagnosticReport examples</a> · Claude when configured; otherwise clearly labelled Gemma fallback</span></footer>
      </main>
    </div>
  );
}
