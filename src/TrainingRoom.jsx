import { useEffect, useMemo, useState } from 'react';

const apiBase = 'http://127.0.0.1:8787/api';

function Icon({ name, size = 18 }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };
  const shapes = {
    cross: <><path d="M12 5v14M5 12h14" /></>,
    spark: <><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" /><path d="m19 16 .9 2.1L22 19l-2.1.9L19 22l-.9-2.1L16 19l2.1-.9L19 16Z" /></>,
    chevron: <path d="m7 10 5 5 5-5" />,
    sound: <><path d="M11 5 6 9H3v6h3l5 4V5Z" /><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14" /></>,
    stop: <><rect x="6" y="6" width="12" height="12" rx="2" /></>,
    send: <><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    arrow: <><path d="M7 17 17 7M7 7h10v10" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    shield: <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" /><path d="m9 12 2 2 4-4" /></>,
    back: <><path d="m15 18-6-6 6-6" /></>,
    refresh: <><path d="M20 7v5h-5M4 17v-5h5" /><path d="M5.5 9a7 7 0 0 1 11.6-2L20 12M4 12l2.9 5a7 7 0 0 0 11.6-2" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
  };
  return <svg {...common}>{shapes[name]}</svg>;
}

function PatientAvatar({ accent, hairStyle, speaking }) {
  const longHair = hairStyle === 'long';
  const curlyHair = hairStyle === 'curly';
  const coveredHair = hairStyle === 'covered';
  const shortHair = !longHair && !curlyHair && !coveredHair;
  return (
    <div className={`portrait portrait-${accent} portrait-hair-${hairStyle} ${speaking ? 'portrait-speaking' : ''}`} aria-label="Illustrated patient avatar">
      <span className="portrait-glow" />
      <svg viewBox="0 0 220 240" role="img" aria-hidden="true">
        <ellipse cx="110" cy="224" rx="69" ry="9" fill="#dfc8c3" opacity=".45" />
        <path d="M40 220c3-40 27-61 70-61s67 21 70 61v12H40z" fill="var(--shirt)" />
        <path d="M85 150h50v34c-7 12-17 18-25 18s-18-6-25-18z" fill="var(--skin)" />
        {longHair && <path d="M64 99c-8-40 4-70 29-80 28-12 63 0 70 33 5 21 2 50-2 80l-9 42-19-5 5-69-56-2 4 71-19 5-9-41c-5-12-6-24-4-34z" fill="var(--hair)" />}
        {curlyHair && <path d="M61 112c-12-19-8-54 9-70 2-18 20-27 36-23 19-14 49-4 56 17 19 12 16 53 4 77l-11-11c-7 23-18 40-26 46l-7-31H91l-8 31c-10-8-18-21-22-36z" fill="var(--hair)" />}
        {coveredHair && <path d="M54 132c-6-61 13-103 56-108 43 5 62 47 56 108l-14 57H68z" fill="var(--shirt)" />}
        {shortHair && <path d="M62 105c-6-39 5-68 34-78 28-10 58 3 65 33 4 15 2 31-2 43l-14-10c-22 1-43-10-56-28-5 15-14 27-27 34z" fill="var(--hair)" />}
        <path d="M66 90c0-36 17-57 45-57s45 21 45 57v31c0 35-20 57-45 57s-45-22-45-57z" fill="var(--skin)" />
        {coveredHair && <path d="M61 105c8-41 24-61 49-61s41 20 49 61c-18-8-36-26-49-46-13 20-31 38-49 46z" fill="var(--shirt)" />}
        {shortHair && <path d="M62 101c-5-24-1-50 14-65 9-9 21-14 34-14 17 0 32 8 41 23 9 15 10 36 5 55l-11-14c-14-5-25-15-33-29-10 15-25 25-44 31l-6 13z" fill="var(--hair)" />}
        {!coveredHair && longHair && <path d="M65 83c5-35 23-54 45-54s40 19 45 54c-16-6-29-19-38-35-12 18-30 31-52 35z" fill="var(--hair)" />}
        {!coveredHair && curlyHair && <path d="M61 101c-8-14-5-38 5-50 2-19 17-28 30-24 11-12 33-13 45-1 18 4 25 28 19 52l-12 19c-6-15-10-26-13-41-9 12-23 19-39 20-10 12-21 20-35 25z" fill="var(--hair)" />}
        <path d="M83 112c5-4 11-4 16 0M121 112c5-4 11-4 16 0" fill="none" stroke="#59413b" strokeWidth="3" strokeLinecap="round" />
        <ellipse cx="91" cy="123" rx="3.8" ry="4.4" fill="#302724" /><ellipse cx="129" cy="123" rx="3.8" ry="4.4" fill="#302724" />
        <path d="M110 124c-2 8-4 14-2 16 2 2 5 2 8 1" fill="none" stroke="#a86659" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M97 143c8 7 18 7 26 0" fill="none" stroke="#fff3e9" strokeWidth="4" strokeLinecap="round" />
        <path className="avatar-mouth" d="M99 146c6 4 15 4 21 0" fill="none" stroke="#873f3e" strokeWidth="3.5" strokeLinecap="round" />
        <path d="M78 174c8 15 19 23 32 23s24-8 32-23l20 11-21 38H79l-21-38z" fill="var(--shirt)" />
        <path d="m93 170 17 19 17-19" fill="none" stroke="#ffffff" strokeOpacity=".72" strokeWidth="3" />
      </svg>
      <span className="portrait-badge"><span /> Patient</span>
    </div>
  );
}

function getReply(caseFile, question, difficulty) {
  const query = question.toLowerCase();
  const topic = caseFile.topics.find((item) => item.keywords.some((keyword) => query.includes(keyword)));
  if (topic) {
    const answer = difficulty === 'Advanced'
      ? `${topic.answer.split(/[.!?]/)[0]}.`
      : `${difficulty === 'Beginner' ? 'Of course. ' : ''}${topic.answer}${difficulty === 'Beginner' ? ' Is there anything else you would like to ask?' : ''}`;
    return { topic: topic.id, text: answer };
  }
  return {
    topic: 'rapport',
    text: "I'm not quite sure. Could you ask me a little differently? I want to make sure I tell you the right thing.",
  };
}

function EvidenceLinks({ ids, references }) {
  const cited = references.filter((reference) => ids.includes(reference.id));
  return (
    <span className="evidence-links" aria-label="Evidence references">
      {cited.map((reference) => <a key={reference.id} href={reference.url} target="_blank" rel="noreferrer" title={`${reference.publisher}: ${reference.title}`}>[{reference.id}]</a>)}
    </span>
  );
}

function TrainingRoom() {
  const [cases, setCases] = useState([]);
  const [casesLoading, setCasesLoading] = useState(true);
  const [casesError, setCasesError] = useState('');
  const [moreCasesLoading, setMoreCasesLoading] = useState(false);
  const [caseId, setCaseId] = useState('');
  const [difficulty, setDifficulty] = useState('Standard');
  const [messages, setMessages] = useState([]);
  const [question, setQuestion] = useState('');
  const [impression, setImpression] = useState('');
  const [clinicalPlan, setClinicalPlan] = useState('');
  const [labOrders, setLabOrders] = useState([]);
  const [selectedTest, setSelectedTest] = useState('');
  const [labLoading, setLabLoading] = useState(false);
  const [labError, setLabError] = useState('');
  const [selectedMedication, setSelectedMedication] = useState('');
  const [medicationReason, setMedicationReason] = useState('');
  const [medicationOrders, setMedicationOrders] = useState([]);
  const [medicationLoading, setMedicationLoading] = useState(false);
  const [medicationError, setMedicationError] = useState('');
  const [debrief, setDebrief] = useState(null);
  const [assessmentError, setAssessmentError] = useState('');
  const [assessmentLoading, setAssessmentLoading] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [audioError, setAudioError] = useState('');
  const caseFile = cases.find((item) => item.id === caseId);
  const askedTopics = useMemo(() => new Set(messages.filter((message) => message.role === 'doctor' && message.topic !== 'rapport').map((message) => message.topic)), [messages]);

  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  useEffect(() => {
    let cancelled = false;
    fetch(`${apiBase}/cases`)
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || `Could not generate cases (HTTP ${response.status}).`);
        return result.cases;
      })
      .then((generatedCases) => {
        if (cancelled) return;
        setCases(generatedCases);
        setCaseId(generatedCases[0]?.id || '');
      })
      .catch((error) => {
        if (!cancelled) setCasesError(error.message || 'Could not load AI-generated cases.');
      })
      .finally(() => {
        if (!cancelled) setCasesLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  async function generateMoreCases() {
    if (moreCasesLoading) return;
    setMoreCasesLoading(true);
    setCasesError('');
    try {
      const response = await fetch(`${apiBase}/cases/generate`, { method: 'POST' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || `Could not generate cases (HTTP ${response.status}).`);
      setCases((current) => [...current, ...result.cases]);
      if (result.cases.length) changeCase(result.cases[0].id);
    } catch (error) {
      setCasesError(error.message || 'Could not generate more practice cases.');
    } finally {
      setMoreCasesLoading(false);
    }
  }

  function changeCase(nextCase) {
    window.speechSynthesis?.cancel();
    setCaseId(nextCase);
    setMessages([]);
    setQuestion('');
    setImpression('');
    setClinicalPlan('');
    setLabOrders([]);
    setSelectedTest('');
    setMedicationOrders([]);
    setSelectedMedication('');
    setMedicationReason('');
    setLabError('');
    setMedicationError('');
    setDebrief(null);
    setAssessmentError('');
    setSpeaking(false);
    setAudioError('');
  }

  function speak(text) {
    if (!('speechSynthesis' in window)) {
      setAudioError('Speech playback is not available in this browser.');
      return;
    }
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    setAudioError('');
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.94;
    utterance.pitch = 1.03;
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = (event) => {
      setSpeaking(false);
      if (event.error !== 'canceled' && event.error !== 'interrupted') {
        setAudioError('Could not play the patient voice. You can continue by reading the transcript.');
      }
    };
    window.speechSynthesis.speak(utterance);
  }

  useEffect(() => {
    if (!caseFile?.opening) return undefined;
    const timer = window.setTimeout(() => speak(caseFile.opening), 400);
    return () => {
      window.clearTimeout(timer);
      window.speechSynthesis?.cancel();
    };
  }, [caseFile?.id, caseFile?.opening]);

  function askPatient(rawQuestion) {
    const cleanQuestion = rawQuestion.trim();
    if (!cleanQuestion || debrief) return;
    const reply = getReply(caseFile, cleanQuestion, difficulty);
    setMessages((current) => [...current, { role: 'doctor', content: cleanQuestion, topic: reply.topic }, { role: 'patient', content: reply.text }]);
    setQuestion('');
  }

  async function orderLabTest() {
    if (!selectedTest || labLoading || labOrders.some((order) => order.test_id === selectedTest)) return;
    setLabLoading(true);
    setLabError('');
    try {
      const response = await fetch(`${apiBase}/labs/order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseId, testId: selectedTest }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || `Lab simulation failed (HTTP ${response.status}).`);
      setLabOrders((current) => [...current, result]);
      setSelectedTest('');
    } catch (error) {
      setLabError(error.message || 'Could not reach the lab simulation service.');
    } finally {
      setLabLoading(false);
    }
  }

  async function orderMedication(event) {
    event.preventDefault();
    if (!selectedMedication || !medicationReason.trim() || medicationLoading) return;
    setMedicationLoading(true);
    setMedicationError('');
    try {
      const response = await fetch(`${apiBase}/medications/order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseId, medicationId: selectedMedication, reason: medicationReason }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || `Medicine order failed (HTTP ${response.status}).`);
      setMedicationOrders((current) => [...current, result]);
      setMedicationReason('');
      setSelectedMedication('');
    } catch (error) {
      setMedicationError(error.message || 'Could not place the simulated medicine order.');
    } finally {
      setMedicationLoading(false);
    }
  }

  async function submitDebrief(event) {
    event.preventDefault();
    if (assessmentLoading || !impression.trim() || !clinicalPlan.trim() || !labOrders.length || askedTopics.size < 2) return;
    setAssessmentLoading(true);
    setAssessmentError('');
    try {
      const response = await fetch(`${apiBase}/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseId, difficulty, impression, clinicalPlan, medicationOrders: medicationOrders.map(({ id, reason }) => ({ id, reason })), labOrders: labOrders.map((order) => order.test_id), messages }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || `Assessment failed (HTTP ${response.status}).`);
      setDebrief(result);
    } catch (error) {
      setAssessmentError(error.message || 'Could not reach the assessment service. Start the API server and try again.');
    } finally {
      setAssessmentLoading(false);
    }
  }

  function startAgain() {
    window.speechSynthesis?.cancel();
    setMessages([]);
    setQuestion('');
    setImpression('');
    setClinicalPlan('');
    setLabOrders([]);
    setSelectedTest('');
    setMedicationOrders([]);
    setSelectedMedication('');
    setMedicationReason('');
    setDebrief(null);
    setLabError('');
    setMedicationError('');
    setSpeaking(false);
    setAudioError('');
    setAssessmentError('');
  }

  if (casesLoading) {
    return <main className="case-loading"><span className="loading-mark"><Icon name="spark" size={20} /></span><h1>Creating fictional practice cases…</h1><p>Ollama is preparing diverse patient scenarios for this training session.</p></main>;
  }

  if (casesError && !caseFile) {
    return <main className="case-loading"><span className="loading-mark"><Icon name="shield" size={20} /></span><h1>Could not load practice cases</h1><p>{casesError}</p><button className="primary-button" onClick={() => window.location.reload()}><Icon name="refresh" size={16} /> Retry</button></main>;
  }

  if (debrief) {
    return (
      <div className="sim-app">
        <header className="sim-topbar">
          <a className="sim-brand" href="#" aria-label="MediNova home"><span className="sim-brand-mark"><Icon name="cross" size={18} /></span><span>medi<span className="brand-nova">nova</span></span></a>
          <div className="topbar-center"><span className="topbar-breadcrumb">SIMULATION</span><span className="topbar-slash">/</span><strong>Case debrief</strong></div>
          <nav className="discussion-nav" aria-label="Main navigation"><a href="/">Practice room</a><a href="/discussion">Scientific discussion</a></nav>
          <span className="training-chip"><span /> PRACTICE MODE</span>
        </header>
        <main className="debrief-page">
          <button className="back-link" onClick={startAgain}><Icon name="back" size={16} /> Back to the case</button>
          <div className="debrief-heading"><div className="section-kicker"><Icon name="spark" size={14} /> THE LEARNING IS IN THE LOOK-BACK</div><h1>That's what practice is for.</h1><p>AI reviewed your interview against guidance retrieved from the web.</p></div>
          <section className="debrief-card">
            <div className="score-panel">
              <span className="score-label">PRACTICE SCORE</span>
              <div className="score-value">{debrief.score}<small>/100</small></div>
              <div className="score-track"><span style={{ width: `${debrief.score}%` }} /></div>
              <div className="score-breakdown">
                <div><span>IMPRESSION</span><strong>{debrief.score_breakdown.impression}/30</strong><EvidenceLinks ids={debrief.score_breakdown.impression_evidence_ids} references={debrief.references} /></div>
                <div><span>HISTORY</span><strong>{debrief.score_breakdown.history}/25</strong><EvidenceLinks ids={debrief.score_breakdown.history_evidence_ids} references={debrief.references} /></div>
                <div><span>INVESTIGATIONS</span><strong>{debrief.score_breakdown.investigations}/25</strong><EvidenceLinks ids={debrief.score_breakdown.investigations_evidence_ids} references={debrief.references} /></div>
                <div><span>SAFETY & PLAN</span><strong>{debrief.score_breakdown.safety_and_plan}/20</strong><EvidenceLinks ids={debrief.score_breakdown.safety_and_plan_evidence_ids} references={debrief.references} /></div>
              </div>
              <p className="score-rationale">{debrief.score_rationale} <EvidenceLinks ids={debrief.score_evidence_ids} references={debrief.references} /></p>
              <p>{debrief.summary} <EvidenceLinks ids={debrief.summary_evidence_ids} references={debrief.references} /></p>
              <div className="score-note"><Icon name="spark" size={15} /> Low stakes. High learning.</div>
            </div>
            <div className="debrief-details">
              <div className="debrief-status"><span className="case-tag">{caseFile.category}</span><span className="preview-engine"><span /> AI assessment · Web-referenced</span></div>
              <h2>{caseFile.title}</h2>
              <div className="answer-reveal answer-good"><div className="reveal-icon"><Icon name="spark" size={17} /></div><div><span>REASONING REVIEW <EvidenceLinks ids={debrief.diagnosis_evidence_ids} references={debrief.references} /></span><strong>{debrief.diagnosis_assessment}</strong></div></div>
              <div className="decision-review">
                <div><span>TEST CHOICE & RESULT INTERPRETATION <EvidenceLinks ids={debrief.investigation_evidence_ids} references={debrief.references} /></span><p>{debrief.investigation_assessment}</p></div>
                <div><span>NEXT STEP & MEDICINE PLAN <EvidenceLinks ids={debrief.plan_evidence_ids} references={debrief.references} /></span><p>{debrief.plan_assessment}</p></div>
              </div>
              <div className="debrief-metrics">
                <div><span>WHAT YOU DID WELL</span>{debrief.strengths.map((item, index) => <p className="feedback-point" key={`strength-${index}`}>{item.text} <EvidenceLinks ids={item.evidence_ids} references={debrief.references} /></p>)}</div>
                <div><span>ROOM TO GROW</span>{debrief.growth_areas.map((item, index) => <p className="feedback-point" key={`growth-${index}`}>{item.text} <EvidenceLinks ids={item.evidence_ids} references={debrief.references} /></p>)}</div>
              </div>
              <div className="next-step"><span>NEXT TIME</span><p>{debrief.next_time} <EvidenceLinks ids={debrief.next_time_evidence_ids} references={debrief.references} /></p></div>
              <div className="reference-list"><div className="reference-heading">WEB REFERENCES RETRIEVED FOR THIS ASSESSMENT</div>{debrief.references.map((reference) => <a href={reference.url} target="_blank" rel="noreferrer" key={reference.id}><span>{reference.id}</span><span><strong>{reference.title}</strong><small>{reference.publisher} · Open source <Icon name="arrow" size={12} /></small></span></a>)}</div>
              <div className="learning-note"><Icon name="shield" size={17} /><p>{caseFile.learning} This educational feedback can be incomplete or wrong; verify it against the linked guidance and qualified supervision.</p></div>
            </div>
          </section>
          <div className="debrief-bottom"><span>AI-generated educational feedback, grounded in retrieved public sources. Not a clinical decision or medical advice.</span><button className="primary-button" onClick={startAgain}><Icon name="refresh" size={16} /> Try another round</button></div>
        </main>
      </div>
    );
  }

  return (
    <div className="sim-app">
      <header className="sim-topbar">
        <a className="sim-brand" href="#" aria-label="MediNova home"><span className="sim-brand-mark"><Icon name="cross" size={18} /></span><span>medi<span className="brand-nova">nova</span></span></a>
        <div className="topbar-center"><span className="topbar-breadcrumb">TRAINING ROOM</span><span className="topbar-slash">/</span><strong>Practice case</strong></div>
        <nav className="discussion-nav" aria-label="Main navigation"><a href="/" aria-current="page">Practice room</a><a href="/discussion">Scientific discussion</a></nav>
        <span className="training-chip"><span /> PRACTICE MODE</span>
      </header>
      <main className="training-page">
        <div className="page-intro">
          <div><div className="section-kicker"><Icon name="spark" size={14} /> A SAFE SPACE TO GET IT WRONG</div><h1>Making mistakes <span>before it counts.</span></h1><p>Meet a patient. Get curious. Learn from what you missed.</p></div>
          <div className="safety-label"><Icon name="shield" size={16} /><span>Fictional cases<br /><strong>Not real patient care</strong></span></div>
        </div>

        <section className="setup-bar" aria-label="Configure practice case">
          <div className="setup-label"><span className="setup-number">01</span><div><strong>Set up your practice</strong><small>Start with one case; generate another when ready</small></div></div>
          <label className="select-field case-select"><span>CASE FOCUS</span><select value={caseId} disabled={assessmentLoading || labLoading || medicationLoading} onChange={(event) => changeCase(event.target.value)}>{cases.map((item) => <option key={item.id} value={item.id}>{item.category}: {item.title}</option>)}</select><Icon name="chevron" size={15} /></label>
          <label className="select-field difficulty-select"><span>DIFFICULTY</span><select value={difficulty} disabled={assessmentLoading || labLoading} onChange={(event) => setDifficulty(event.target.value)}><option>Beginner</option><option>Standard</option><option>Advanced</option></select><Icon name="chevron" size={15} /></label>
          <button className="generate-cases-button" type="button" onClick={generateMoreCases} disabled={moreCasesLoading || assessmentLoading || labLoading || medicationLoading}><Icon name={moreCasesLoading ? 'clock' : 'refresh'} size={14} />{moreCasesLoading ? 'Generating…' : 'Generate a new case'}</button>
          <div className="setup-status"><span className="setup-status-dot" /> {cases.length} cases</div>
        </section>
        {casesError && <p className="lab-error" role="alert">{casesError}</p>}

        <div className="step-track" aria-label="Practice steps"><div className="step-item active"><span>1</span>Meet the patient</div><i /><div className={`step-item ${messages.length ? 'active' : ''}`}><span>2</span>Explore & investigate</div><i /><div className={`step-item ${labOrders.length && clinicalPlan ? 'active' : ''}`}><span>3</span>Decide & debrief</div></div>

        <div className="room-grid">
          <section className="patient-card">
            <div className="card-topline"><div className="card-title"><span className="live-pip" /> YOUR PATIENT IS HERE</div><span className="case-tag">{caseFile.category}</span></div>
            <div className="patient-profile">
              <PatientAvatar accent={caseFile.accent} hairStyle={caseFile.hairStyle} speaking={speaking} />
              <div className="patient-details"><div className="patient-label">TODAY'S PATIENT</div><h2>{caseFile.patient}</h2><p>{caseFile.age} years old</p><span className="patient-context"><span /> First visit <i /> History not yet taken</span></div>
            </div>
            <div className="opening-quote">
              <div className="quote-mark">“</div>
              <div><span className="quote-label">IN THEIR OWN WORDS</span><p>{caseFile.opening}</p></div>
              <button className={`voice-button ${speaking ? 'voice-active' : ''}`} onClick={() => speak(caseFile.opening)} aria-label={speaking ? 'Stop patient voice' : 'Replay patient voice'} title={speaking ? 'Stop voice' : 'Replay patient statement'}><Icon name={speaking ? 'stop' : 'sound'} size={17} />{speaking ? 'Stop' : 'Replay'}</button>
            </div>
            {audioError && <p className="audio-note" role="status">{audioError}</p>}
            <div className="conversation-head"><div><span className="conversation-title">THE CONVERSATION</span><span className="conversation-subtitle">{messages.length ? `${messages.filter((message) => message.role === 'doctor').length} questions asked` : 'Your interview starts here'}</span></div><span className="privacy-chip"><Icon name="shield" size={13} /> SIMULATED</span></div>
            <div className="conversation-log" aria-live="polite">
              {!messages.length ? <div className="empty-conversation"><span className="empty-icon"><Icon name="send" size={17} /></span><p>Ask an open question to get started.</p><small>The patient will answer in their own words.</small></div> : messages.map((message, index) => (
                <div className={`chat-line ${message.role}`} key={`${index}-${message.role}`}><span className={`chat-avatar ${message.role === 'patient' ? `chat-patient-${caseFile.accent}` : 'chat-doctor'}`}>{message.role === 'patient' ? caseFile.initials : 'JD'}</span><div className="chat-message"><div className="chat-name">{message.role === 'patient' ? caseFile.patient : 'You'} <span>{message.role === 'patient' ? 'PATIENT' : 'YOU'}</span></div><p>{message.content}</p></div>{message.role === 'patient' && <button className="reply-sound" onClick={() => speak(message.content)} aria-label={`Listen to ${caseFile.patient}`}><Icon name="sound" size={15} /></button>}</div>
              ))}</div>
          </section>

          <aside className="clinician-card">
            <div className="clinician-heading"><div><div className="card-title">YOUR SIDE OF THE ROOM</div><p>Listen closely. Stay curious.</p></div><span className="clinician-mark"><Icon name="cross" size={15} /></span></div>
            <div className="question-section"><div className="subhead-row"><h3>Ask your patient</h3><span>{messages.filter((message) => message.role === 'doctor').length} asked</span></div>
              <form className="question-composer" onSubmit={(event) => { event.preventDefault(); askPatient(question); }}>
                <input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="What would you like to know?" aria-label="Question for the patient" disabled={assessmentLoading || labLoading} />
                <button type="submit" disabled={!question.trim() || assessmentLoading || labLoading} aria-label="Send question"><Icon name="send" size={16} /></button>
              </form>
              <span className="suggestion-label">A FEW PLACES TO START</span>
              <div className="suggestion-list">{caseFile.suggested.map((suggestion) => <button key={suggestion} disabled={assessmentLoading || labLoading} onClick={() => askPatient(suggestion)}><Icon name="plus" size={14} /><span>{suggestion}</span></button>)}</div>
            </div>
            <div className="lab-section">
              <div className="subhead-row"><h3>Order a simulated test</h3><span>{labOrders.length} result{labOrders.length === 1 ? '' : 's'}</span></div>
              <p className="assessment-hint">Choose a text-report investigation that fits your differential. Results are AI-generated fictional teaching data.</p>
              <div className="lab-order-controls">
                <select aria-label="Choose a lab test" value={selectedTest} disabled={assessmentLoading || labLoading} onChange={(event) => setSelectedTest(event.target.value)}>
                  <option value="">Choose a test…</option>
                  {caseFile.tests.filter((test) => !labOrders.some((order) => order.test_id === test.id)).map((test) => <option key={test.id} value={test.id}>{test.name}</option>)}
                </select>
                <button type="button" disabled={!selectedTest || assessmentLoading || labLoading} onClick={orderLabTest}>{labLoading ? 'Simulating…' : 'Order'}</button>
              </div>
              {labError && <p className="lab-error" role="alert">{labError}</p>}
              {labOrders.map((order) => <article className="lab-result" key={order.test_id}>
                <div className="lab-result-head"><strong>{order.test_name}</strong><span>SIMULATED</span></div>
                <div className="lab-findings">{order.findings.map((finding) => <div key={finding.name}><span>{finding.name}</span><strong>{finding.value}</strong></div>)}</div>
                <p>{order.summary}</p><small>{order.note}</small>
              </article>)}
            </div>
            <div className="medication-section">
              <div className="subhead-row"><h3>Simulated medicine orders</h3><span>{medicationOrders.length} placed</span></div>
              <p className="assessment-hint">Choose an educational option if appropriate. No dose is entered, and no real prescription is created.</p>
              <form className="medicine-order-form" onSubmit={orderMedication}>
                <select aria-label="Choose a simulated medicine" value={selectedMedication} onChange={(event) => setSelectedMedication(event.target.value)} disabled={assessmentLoading || medicationLoading || labLoading}>
                  <option value="">No medicine order / choose an option…</option>
                  {caseFile.medications.filter((item) => !medicationOrders.some((order) => order.id === item.id)).map((item) => <option key={item.id} value={item.id}>{item.name} — {item.indication}</option>)}
                </select>
                <textarea aria-label="Medicine order rationale" value={medicationReason} onChange={(event) => setMedicationReason(event.target.value)} placeholder="Why might this be appropriate in the fictional case? Consider safety." rows="2" disabled={assessmentLoading || medicationLoading || labLoading} />
                <button type="submit" disabled={!selectedMedication || !medicationReason.trim() || assessmentLoading || medicationLoading || labLoading}>{medicationLoading ? 'Placing…' : 'Place simulated order'}</button>
              </form>
              {medicationError && <p className="lab-error" role="alert">{medicationError}</p>}
              {medicationOrders.map((order) => <article className="medication-order" key={order.id}><div><strong>{order.name}</strong><span>SIMULATED · NO DOSE</span></div><p>{order.reason}</p><small>{order.note}</small></article>)}
            </div>
            <div className="assessment-section"><div className="subhead-row"><h3>Working impression</h3><span>Private until debrief</span></div><p className="assessment-hint">What pattern are you considering? You can change your mind—that's the point.</p>
              <textarea value={impression} onChange={(event) => setImpression(event.target.value)} placeholder="What condition or pattern are you considering?" aria-label="Your provisional clinical impression" rows="2" disabled={assessmentLoading || labLoading} />
              <label className="plan-label" htmlFor="clinical-plan">TEST INTERPRETATION & NEXT STEP</label>
              <textarea id="clinical-plan" value={clinicalPlan} onChange={(event) => setClinicalPlan(event.target.value)} placeholder="Interpret the history and results. What would you do next in this fictional case?" aria-label="Your test interpretation and next clinical decision" rows="3" disabled={assessmentLoading || labLoading} />
            </div>
            <button className="debrief-button" onClick={submitDebrief} disabled={assessmentLoading || labLoading || medicationLoading || askedTopics.size < 2 || !labOrders.length || !impression.trim() || !clinicalPlan.trim()}><span>{assessmentLoading ? 'Retrieving references & assessing your reasoning…' : 'Finish & review my reasoning'}</span><Icon name={assessmentLoading ? 'clock' : 'arrow'} size={16} /></button>
            <p className={`debrief-prerequisite ${assessmentError ? 'assessment-error' : ''}`} role={assessmentError ? 'alert' : 'status'}>{assessmentError || (askedTopics.size < 2 ? 'Explore at least 2 areas before your debrief.' : !labOrders.length ? 'Order and review at least one simulated test.' : !impression.trim() ? 'Add a working impression when you feel ready.' : !clinicalPlan.trim() ? 'Add your interpretation and next-step plan.' : 'Your reference pattern stays hidden until assessment completes.')}</p>
            <div className="engine-note"><span className="engine-indicator" /><span>AI assessment <i>·</i> Web references required</span><Icon name="spark" size={14} /></div>
          </aside>
        </div>
        <footer className="training-footer"><span>Practice, reflect, repeat. <strong>That's how confidence is built.</strong></span><span>Fictional educational simulation <i>·</i> Not for diagnosis or treatment</span></footer>
      </main>
    </div>
  );
}

export default TrainingRoom;
