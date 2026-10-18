import { useEffect, useMemo, useRef, useState } from 'react';
import { extractPdfPages } from './pdfMaterials.js';

const apiBase = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8787/api';

const doctors = [
  { id: 'clinician', name: 'Dr. Maya Chen', role: 'Clinical perspective', color: 'coral', initials: 'MC', gender: 'female' },
  { id: 'researcher', name: 'Dr. Elias Okafor', role: 'Evidence synthesis', color: 'blue', initials: 'EO', gender: 'male' },
  { id: 'reviewer', name: 'Dr. Priya Shah', role: 'Critical appraisal', color: 'sage', initials: 'PS', gender: 'female' },
];

const preferredVoiceNames = {
  female: ['Aria', 'Jenny', 'Sonia', 'Libby', 'Michelle', 'Zira', 'Samantha', 'Google UK English Female'],
  male: ['Guy', 'Ryan', 'Davis', 'Brian', 'Christopher', 'Eric', 'David', 'Daniel', 'Google UK English Male'],
};

function Citation({ source, onSelect }) {
  return (
    <button className="discussion-citation" type="button" onClick={() => onSelect(source.id)} title={`${source.documentName}, page ${source.pageNumber}`}>
      {source.documentName} · p. {source.pageNumber}
    </button>
  );
}

export default function ScientificDiscussion() {
  const [files, setFiles] = useState([]);
  const [topic, setTopic] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [session, setSession] = useState(null);
  const [discussion, setDiscussion] = useState(null);
  const [preparing, setPreparing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [raisingHand, setRaisingHand] = useState(false);
  const [participantQuestion, setParticipantQuestion] = useState('');
  const [listening, setListening] = useState(false);
  const [autoPlayVoice, setAutoPlayVoice] = useState(true);
  const [speakingDoctor, setSpeakingDoctor] = useState('');
  const [arxivSearch, setArxivSearch] = useState({ status: 'idle', papers: [], error: '', query: '' });
  const recognitionRef = useRef(null);
  const speechQueueRef = useRef([]);
  const playTokenRef = useRef(0);
  const arxivControllerRef = useRef(null);
  const sources = useMemo(() => discussion?.sources ?? [], [discussion]);

  useEffect(() => {
    return () => {
      playTokenRef.current += 1;
      speechQueueRef.current = [];
      window.speechSynthesis?.cancel();
      recognitionRef.current?.stop();
      arxivControllerRef.current?.abort();
    };
  }, []);

  function stopSpeech() {
    playTokenRef.current += 1;
    speechQueueRef.current = [];
    window.speechSynthesis?.cancel();
    setSpeakingDoctor('');
  }

  async function getVoicesReady() {
    const synth = window.speechSynthesis;
    const waitForVoiceChange = (timeoutMs) => new Promise((resolve) => {
      let timeout;
      const finish = () => {
        synth.removeEventListener('voiceschanged', finish);
        window.clearTimeout(timeout);
        resolve();
      };
      timeout = window.setTimeout(finish, timeoutMs);
      synth.addEventListener('voiceschanged', finish, { once: true });
    });
    if (!synth.getVoices().length) await waitForVoiceChange(2500);
    if (!synth.getVoices().some((voice) => /natural|online/i.test(voice.name))) await waitForVoiceChange(800);
    return synth.getVoices();
  }

  function chooseVoice(voices, gender, usedNames) {
    const english = voices.filter((voice) => /^en(?:-|_|$)/i.test(voice.lang));
    const natural = english.filter((voice) => /natural|online/i.test(voice.name));
    const pool = natural.length ? natural : english;
    const available = pool.filter((voice) => !usedNames.has(voice.name));
    const candidates = available.length ? available : pool;
    for (const preferredName of preferredVoiceNames[gender]) {
      const match = candidates.find((voice) => voice.name.toLowerCase().includes(preferredName.toLowerCase()));
      if (match) return match;
    }
    return candidates[0] || pool[0] || null;
  }

  async function playTurns(turns) {
    if (!window.speechSynthesis || typeof window.SpeechSynthesisUtterance !== 'function') {
      setError('Voice playback is not supported in this browser.');
      return;
    }
    stopSpeech();
    const token = playTokenRef.current;
    const voices = await getVoicesReady();
    if (token !== playTokenRef.current) return;
    const voiceByDoctor = {};
    const usedNames = new Set();
    for (const doctor of doctors) {
      const voice = chooseVoice(voices, doctor.gender, usedNames);
      if (voice) {
        voiceByDoctor[doctor.name] = voice;
        usedNames.add(voice.name);
      }
    }
    speechQueueRef.current = turns
      .filter((turn) => !turn.participant)
      .flatMap((turn) => {
        const doctorIndex = Math.max(0, doctors.findIndex((doctor) => doctor.name === turn.speaker));
        const sentences = turn.text.match(/[^.!?]+[.!?]+["')\]]*\s*|[^.!?]+$/g) || [turn.text];
        return sentences.map((text) => ({ speaker: turn.speaker, text: text.trim(), doctorIndex }));
      })
      .filter((turn) => turn.text);
    const speakNext = () => {
      if (token !== playTokenRef.current) return;
      const turn = speechQueueRef.current.shift();
      if (!turn) {
        setSpeakingDoctor('');
        return;
      }
      const utterance = new window.SpeechSynthesisUtterance(turn.text);
      const voice = voiceByDoctor[turn.speaker];
      if (voice) {
        utterance.voice = voice;
        utterance.lang = voice.lang;
      } else {
        utterance.lang = 'en-US';
      }
      utterance.rate = [0.92, 0.9, 0.92][turn.doctorIndex];
      utterance.pitch = 1;
      setSpeakingDoctor(turn.speaker);
      utterance.onend = speakNext;
      utterance.onerror = (event) => {
        if (token !== playTokenRef.current) return;
        if (!['canceled', 'interrupted'].includes(event.error)) setError(`Voice playback failed: ${event.error}.`);
        speakNext();
      };
      window.speechSynthesis.speak(utterance);
    };
    speakNext();
  }

  async function searchArxiv(query) {
    arxivControllerRef.current?.abort();
    const controller = new AbortController();
    arxivControllerRef.current = controller;
    setArxivSearch({ status: 'loading', papers: [], error: '', query });
    try {
      const response = await fetch(`${apiBase}/research/arxiv?q=${encodeURIComponent(query)}`, { signal: controller.signal });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || `arXiv search failed (HTTP ${response.status}).`);
      setArxivSearch({ status: 'ready', papers: result.papers, error: '', query });
    } catch (searchError) {
      if (searchError.name === 'AbortError') return;
      setArxivSearch({ status: 'error', papers: [], error: searchError.message || 'Could not search arXiv.', query });
    }
  }

  function chooseFiles(fileList) {
    const selected = Array.from(fileList);
    setError('');
    setSession(null);
    setDiscussion(null);
    arxivControllerRef.current?.abort();
    setArxivSearch({ status: 'idle', papers: [], error: '', query: '' });
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

  async function prepareMaterial() {
    if (!files.length || preparing) return;
    setPreparing(true);
    setError('');
    setDiscussion(null);
    try {
      const pages = await extractPdfPages(files, setStatus);
      setStatus('Preparing searchable passages…');
      const response = await fetch(`${apiBase}/discussions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pages }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || `Could not prepare the PDFs (HTTP ${response.status}).`);
      setSession(result);
      setStatus(`Ready · ${result.pageCount} readable pages indexed into ${result.chunkCount} passages`);
    } catch (prepareError) {
      setStatus('');
      setError(prepareError.message || 'Could not read these PDFs.');
    } finally {
      setPreparing(false);
    }
  }

  async function generateDiscussion(event) {
    event.preventDefault();
    if (!session || !topic.trim() || generating) return;
    setGenerating(true);
    setError('');
    setDiscussion(null);
    try {
      const response = await fetch(`${apiBase}/discussions/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session.sessionId, topic: topic.trim() }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || `Could not generate discussion (HTTP ${response.status}).`);
      setDiscussion(result);
      if (autoPlayVoice) void playTurns(result.discussion);
      void searchArxiv(result.topic);
    } catch (generationError) {
      setError(generationError.message || 'Could not generate the discussion.');
    } finally {
      setGenerating(false);
    }
  }

  async function continueDiscussion(question) {
    const cleanQuestion = question.trim();
    if (!session || !discussion || !cleanQuestion || generating) return;
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setListening(false);
    setGenerating(true);
    setError('');
    try {
      const previousTurns = discussion.discussion.slice(-30).map((turn) => ({
        speaker: turn.participant ? 'participant' : turn.speaker,
        text: turn.text,
      }));
      const response = await fetch(`${apiBase}/discussions/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session.sessionId, topic: discussion.topic, question: cleanQuestion, previousTurns }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || `Could not continue discussion (HTTP ${response.status}).`);
      const participantTurn = { speaker: 'You', role: 'Participant', text: cleanQuestion, citations: [], participant: true };
      setDiscussion((current) => ({
        ...current,
        discussion: [...current.discussion, participantTurn, ...result.discussion],
        sources: [...new Map([...current.sources, ...result.sources].map((source) => [source.id, source])).values()],
      }));
      void searchArxiv(`${discussion.topic} ${cleanQuestion}`);
      setParticipantQuestion('');
      setRaisingHand(false);
      if (autoPlayVoice) void playTurns(result.discussion);
    } catch (responseError) {
      setError(responseError.message || 'Could not continue the discussion.');
    } finally {
      setGenerating(false);
    }
  }

  function raiseHand() {
    stopSpeech();
    setParticipantQuestion('');
    setError('');
    setRaisingHand(true);
  }

  function cancelRaiseHand() {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setListening(false);
    setRaisingHand(false);
  }

  function startSpeechRecognition() {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      setError('Speech transcription is not supported in this browser. Type your question instead, or try a recent version of Chrome or Edge.');
      return;
    }
    setError('');
    const recognition = new Recognition();
    recognition.lang = navigator.language || 'en-US';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results).map((result) => result[0].transcript).join(' ').trim();
      if (!transcript) {
        setError('No speech was transcribed. Please try again or type your question.');
        return;
      }
      setParticipantQuestion(transcript);
      recognitionRef.current = null;
      setListening(false);
      void continueDiscussion(transcript);
    };
    recognition.onerror = (event) => {
      if (event.error !== 'aborted') setError(event.error === 'not-allowed'
        ? 'Microphone access was blocked. Allow microphone access in your browser settings, or type your question.'
        : `Speech transcription failed (${event.error}). Please try again or type your question.`);
      setListening(false);
      recognitionRef.current = null;
    };
    recognition.onend = () => {
      setListening(false);
      if (recognitionRef.current === recognition) recognitionRef.current = null;
    };
    recognitionRef.current = recognition;
    setListening(true);
    try {
      recognition.start();
    } catch (recognitionError) {
      recognitionRef.current = null;
      setListening(false);
      setError(`Could not start speech transcription: ${recognitionError.message}`);
    }
  }

  function selectSource(sourceId) {
    document.getElementById(`source-${sourceId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  return (
    <div className="sim-app discussion-app">
      <header className="sim-topbar">
        <a className="sim-brand" href="/" aria-label="MediNova home"><span className="sim-brand-mark">✚</span><span>medi<span className="brand-nova">nova</span></span></a>
        <nav className="discussion-nav" aria-label="Main navigation">
          <a href="/">Practice room</a>
          <span aria-current="page">Scientific discussion</span>
          <a href="/case-generator">Generate from PDFs</a>
          <a href="/image-assessment">Image assessment</a>
          <a href="/report-assessment">Lab report</a>
        </nav>
        <span className="training-chip"><span /> EDUCATION MODE</span>
      </header>

      <main className="discussion-page">
        <div className="discussion-intro">
          <div>
            <div className="section-kicker">EVIDENCE IN CONVERSATION</div>
            <h1>Read closely.<br /><span>Think it through together.</span></h1>
            <p>Bring your learning material into a structured, source-grounded discussion between three fictional doctors.</p>
          </div>
          <aside className="discussion-safety"><strong>Learning tool, not clinical guidance</strong><span>AI discussion can be incomplete or wrong. Verify claims against the source material and qualified supervision.</span></aside>
        </div>

        <div className="discussion-layout">
          <section className="discussion-workspace">
            <section className="discussion-panel upload-panel">
              <div className="discussion-panel-heading"><span className="setup-number">01</span><div><h2>Add learning material</h2><p>PDFs are parsed in your browser; extracted text is indexed in local API memory for up to two hours. Retrieved excerpts are sent to your configured Ollama service for discussion.</p><p className="discussion-privacy-note">Use de-identified educational material only. Do not upload identifiable patient records or include patient details in your topic or questions; search terms go to arXiv’s public API.</p></div></div>
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
                <button className="primary-button" type="button" onClick={prepareMaterial} disabled={!files.length || preparing || generating}>
                  {preparing ? 'Reading PDFs…' : session ? 'Re-index PDFs' : 'Extract & index material'}
                </button>
                {status && <span className="discussion-progress" role="status">{status}</span>}
              </div>
            </section>

            <form className="discussion-panel topic-panel" onSubmit={generateDiscussion}>
              <div className="discussion-panel-heading"><span className="setup-number">02</span><div><h2>Set the discussion question</h2><p>Use a focused question or concept from your uploaded material.</p></div></div>
              <label className="discussion-topic-label" htmlFor="discussion-topic">TOPIC OR QUESTION</label>
              <textarea id="discussion-topic" value={topic} onChange={(event) => setTopic(event.target.value)} maxLength={500} placeholder="For example: How does the source compare the diagnostic criteria and limitations?" />
              <div className="discussion-actions">
                <button className="primary-button" type="submit" disabled={!session || !topic.trim() || generating || preparing}>
                  {generating ? 'Three doctors are discussing…' : 'Start scientific discussion'}
                </button>
                {session && <span className="discussion-ready">{session.pageCount} pages · {session.chunkCount} searchable passages</span>}
              </div>
            </form>

            {error && <div className="discussion-error" role="alert">{error}</div>}

            <section className="discussion-panel conversation-panel" aria-live="polite">
              <div className="conversation-panel-heading">
                <div><span className="section-kicker">THE ROUNDTABLE</span><h2>{discussion ? discussion.topic : 'A considered conversation'}</h2></div>
                {discussion && <div className="conversation-controls">
                  <button className={`voice-toggle ${autoPlayVoice ? 'is-enabled' : ''}`} type="button" onClick={() => { setAutoPlayVoice((enabled) => !enabled); if (autoPlayVoice) stopSpeech(); }} aria-pressed={autoPlayVoice}>
                    {autoPlayVoice ? 'Auto voice on' : 'Auto voice off'}
                  </button>
                  {speakingDoctor && <button className="voice-toggle" type="button" onClick={stopSpeech}>Stop voice</button>}
                  <button className="raise-hand-button" type="button" onClick={raiseHand} disabled={generating || raisingHand}>Raise hand</button>
                </div>}
              </div>
              {raisingHand && <form className="raise-hand-panel" onSubmit={(event) => { event.preventDefault(); void continueDiscussion(participantQuestion); }}>
                <div className="raise-hand-heading"><strong>Your turn to join in</strong><span>Share a thought or ask a question; the doctors will respond using your uploaded sources.</span></div>
                <textarea value={participantQuestion} onChange={(event) => setParticipantQuestion(event.target.value)} maxLength={2000} disabled={generating || listening} placeholder="What would you like to ask the doctors?" aria-label="Your question or thought" autoFocus />
                {listening && <span className="listening-status" role="status">Listening… speak your question clearly.</span>}
                <div className="raise-hand-actions">
                  <button className={`microphone-button ${listening ? 'is-listening' : ''}`} type="button" onClick={listening ? cancelRaiseHand : startSpeechRecognition} disabled={generating} aria-pressed={listening}>{listening ? 'Stop listening' : 'Speak question'}</button>
                  <span className="raise-hand-hint">Speaking submits the transcript automatically. You can also type and review before sending.</span>
                  <button className="primary-button" type="submit" disabled={!participantQuestion.trim() || generating || listening}>{generating ? 'Doctors are responding…' : 'Send to the doctors'}</button>
                  <button className="cancel-hand-button" type="button" onClick={cancelRaiseHand} disabled={generating}>Cancel</button>
                </div>
              </form>}
              {!discussion && (
                <div className="roundtable-empty">
                  {doctors.map((doctor) => <div className="doctor-preview" key={doctor.id}><span className={`doctor-avatar avatar-${doctor.color}`}>{doctor.initials}</span><span><strong>{doctor.name}</strong><small>{doctor.role}</small></span></div>)}
                  <p>{generating ? 'Retrieving relevant passages and grounding the discussion…' : 'Your source-grounded discussion will appear here after you index a PDF and choose a question.'}</p>
                </div>
              )}
              {discussion && <div className="discussion-turns">{discussion.discussion.map((turn, index) => {
                const doctor = doctors.find((person) => person.name === turn.speaker);
                return (
                  <article className={`discussion-turn ${turn.participant ? 'participant-turn' : ''}`} key={`${turn.speaker}-${index}`}>
                    <span className={`doctor-avatar ${turn.participant ? 'participant-avatar' : `avatar-${doctor?.color || 'coral'}`}`}>{doctor?.initials || turn.speaker.split(' ').slice(-1)[0][0]}</span>
                    <div className="discussion-turn-body">
                      <div className="discussion-speaker"><strong>{turn.speaker}</strong><span>{turn.role}</span>{doctor && <button className={`hear-turn-button ${speakingDoctor === turn.speaker ? 'is-speaking' : ''}`} type="button" onClick={() => playTurns([turn])} aria-label={`Play ${doctor.name}'s response`}>{speakingDoctor === turn.speaker ? 'Speaking…' : 'Hear response'}</button>}</div>
                      <p>{turn.text}</p>
                      {turn.citations.length > 0 && <div className="discussion-citations">{turn.citations.map((source) => <Citation key={`${source.id}-${index}`} source={source} onSelect={selectSource} />)}</div>}
                    </div>
                  </article>
                );
              })}</div>}
            </section>
          </section>

          <aside className="discussion-sources">
            <div className="discussion-sources-heading"><span className="section-kicker">RETRIEVED EVIDENCE</span><h2>From your material</h2><p>Passages selected for the current question. Citations in the discussion link here.</p></div>
            {!sources.length
              ? <div className="source-empty">Relevant page excerpts will appear here when a discussion is generated.</div>
              : sources.map((source) => <article className="source-card" id={`source-${source.id}`} key={source.id}><div className="source-card-meta"><span>{source.documentName}</span><strong>PAGE {source.pageNumber}</strong></div><p>{source.text}</p></article>)}
            <section className="arxiv-section" aria-live="polite">
              <div className="discussion-sources-heading arxiv-heading">
                <span className="section-kicker">RELATED RESEARCH</span>
                <h2>arXiv papers</h2>
                <p>Discussion topics and questions are searched through arXiv’s public API. These papers are further reading, not evidence used to generate the discussion.</p>
              </div>
              {arxivSearch.status === 'idle' && <div className="source-empty">Related papers will appear when the doctors start discussing.</div>}
              {arxivSearch.status === 'loading' && <div className="source-empty" role="status">Searching arXiv for “{arxivSearch.query}” …</div>}
              {arxivSearch.status === 'error' && <div className="arxiv-error" role="alert">{arxivSearch.error}<button type="button" onClick={() => void searchArxiv(arxivSearch.query)}>Retry search</button></div>}
              {arxivSearch.status === 'ready' && !arxivSearch.papers.length && <div className="source-empty">No relevant arXiv papers found for this discussion topic.</div>}
              {arxivSearch.papers.map((paper) => <article className="arxiv-paper" key={paper.url}>
                <div className="arxiv-paper-meta">{[paper.source, paper.year].filter(Boolean).join(' · ')}</div>
                <h3>{paper.title}</h3>
                {paper.authors.length > 0 && <p className="arxiv-authors">{paper.authors.join(', ')}{paper.authors.length === 4 ? ', et al.' : ''}</p>}
                <p className="arxiv-abstract">{paper.abstract}</p>
                <a href={paper.url} target="_blank" rel="noopener noreferrer">Read paper on arXiv ↗</a>
              </article>)}
            </section>
          </aside>
        </div>
        <footer className="discussion-footer"><span>“Making mistakes before it counts.”</span><span>Fictional AI-generated discussion · Verify against original sources.</span></footer>
      </main>
    </div>
  );
}
