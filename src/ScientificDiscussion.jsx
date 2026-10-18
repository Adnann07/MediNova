import { useEffect, useMemo, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { createWorker } from 'tesseract.js';

const apiBase = 'http://127.0.0.1:8787/api';
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const doctors = [
  { id: 'clinician', name: 'Dr. Maya Chen', role: 'Clinical perspective', color: 'coral', initials: 'MC' },
  { id: 'researcher', name: 'Dr. Elias Okafor', role: 'Evidence synthesis', color: 'blue', initials: 'EO' },
  { id: 'reviewer', name: 'Dr. Priya Shah', role: 'Critical appraisal', color: 'sage', initials: 'PS' },
];

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
  const [autoPlayVoice, setAutoPlayVoice] = useState(false);
  const [speakingDoctor, setSpeakingDoctor] = useState('');
  const [speechVoices, setSpeechVoices] = useState([]);
  const recognitionRef = useRef(null);
  const speechQueueRef = useRef([]);
  const sources = useMemo(() => discussion?.sources ?? [], [discussion]);

  useEffect(() => {
    if (!window.speechSynthesis) return undefined;
    const updateVoices = () => setSpeechVoices(window.speechSynthesis.getVoices());
    updateVoices();
    window.speechSynthesis.addEventListener('voiceschanged', updateVoices);
    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', updateVoices);
      window.speechSynthesis.cancel();
      recognitionRef.current?.stop();
    };
  }, []);

  function stopSpeech() {
    speechQueueRef.current = [];
    window.speechSynthesis?.cancel();
    setSpeakingDoctor('');
  }

  function playTurns(turns) {
    if (!window.speechSynthesis || typeof window.SpeechSynthesisUtterance !== 'function') {
      setError('Voice playback is not supported in this browser.');
      return;
    }
    speechQueueRef.current = turns.filter((turn) => !turn.participant).slice();
    window.speechSynthesis.cancel();
    const speakNext = () => {
      const turn = speechQueueRef.current.shift();
      if (!turn) {
        setSpeakingDoctor('');
        return;
      }
      const doctorIndex = Math.max(0, doctors.findIndex((doctor) => doctor.name === turn.speaker));
      const englishVoices = speechVoices.filter((voice) => /^en(?:-|$)/i.test(voice.lang));
      const utterance = new window.SpeechSynthesisUtterance(turn.text);
      if (englishVoices.length) utterance.voice = englishVoices[doctorIndex % englishVoices.length];
      utterance.rate = [0.96, 1, 0.98][doctorIndex];
      utterance.pitch = [1.04, 0.94, 1.12][doctorIndex];
      setSpeakingDoctor(turn.speaker);
      utterance.onend = speakNext;
      utterance.onerror = (event) => {
        if (!['canceled', 'interrupted'].includes(event.error)) setError(`Voice playback failed: ${event.error}.`);
        speakNext();
      };
      window.speechSynthesis.speak(utterance);
    };
    speakNext();
  }

  function chooseFiles(fileList) {
    const selected = Array.from(fileList);
    setError('');
    setSession(null);
    setDiscussion(null);
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
    let ocrWorker;
    try {
      const pages = [];
      for (const file of files) {
        setStatus(`Reading ${file.name}…`);
        const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
        if (pdf.numPages > 40 || pages.length + pdf.numPages > 80) {
          throw new Error('Keep each PDF to 40 pages or fewer and the combined upload to 80 pages or fewer.');
        }
        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
          setStatus(`Extracting ${file.name} · page ${pageNumber} of ${pdf.numPages}`);
          const page = await pdf.getPage(pageNumber);
          const textContent = await page.getTextContent();
          let text = textContent.items
            .filter((item) => 'str' in item)
            .map((item) => item.str)
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();

          if (text.length < 40) {
            if (!ocrWorker) {
              setStatus('Starting local OCR for scanned pages…');
              ocrWorker = await createWorker('eng', 1, {
                logger: (message) => {
                  if (message.status === 'recognizing text') {
                    setStatus(`Reading scanned page · ${Math.round((message.progress || 0) * 100)}%`);
                  }
                },
              });
            }
            const baseViewport = page.getViewport({ scale: 1 });
            const viewport = page.getViewport({ scale: Math.min(2, 1400 / baseViewport.width) });
            const canvas = document.createElement('canvas');
            canvas.width = Math.ceil(viewport.width);
            canvas.height = Math.ceil(viewport.height);
            const context = canvas.getContext('2d');
            if (!context) throw new Error('Could not create a canvas for OCR in this browser.');
            await page.render({ canvasContext: context, viewport }).promise;
            const recognized = await ocrWorker.recognize(canvas);
            if (recognized.data.text.trim().length > text.length) text = recognized.data.text.trim();
            canvas.width = 0;
            canvas.height = 0;
          }

          if (text.trim().length >= 20) {
            pages.push({ documentName: file.name, pageNumber, text: text.slice(0, 10_000) });
          }
          page.cleanup();
        }
        await pdf.destroy();
      }
      if (!pages.length) throw new Error('No readable text was found. Try a clearer PDF or one with selectable text.');
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
      if (ocrWorker) await ocrWorker.terminate();
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
      if (autoPlayVoice) playTurns(result.discussion);
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
      setParticipantQuestion('');
      setRaisingHand(false);
      if (autoPlayVoice) playTurns(result.discussion);
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
              <div className="discussion-panel-heading"><span className="setup-number">01</span><div><h2>Add learning material</h2><p>PDFs are parsed in your browser; extracted text is indexed in local API memory for up to two hours. Retrieved excerpts are sent to your configured Ollama service for discussion.</p><p className="discussion-privacy-note">Use de-identified educational material only. Do not upload identifiable patient records or confidential documents.</p></div></div>
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
          </aside>
        </div>
        <footer className="discussion-footer"><span>“Making mistakes before it counts.”</span><span>Fictional AI-generated discussion · Verify against original sources.</span></footer>
      </main>
    </div>
  );
}
