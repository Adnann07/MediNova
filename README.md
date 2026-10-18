# MediNova

MediNova is a browser-based clinical learning simulator built around the idea **“Making mistakes before it counts.”** It provides fictional, low-stakes practice for patient interviews, clinical reasoning, investigations, and interpretation of published medical material.

> **Educational use only.** MediNova is not a medical device, clinical decision-support system, diagnostic service, or substitute for supervised training. Do not use it to make decisions about real patients or upload identifiable patient information.

## Contents

- [What the application does](#what-the-application-does)
- [Technology stack](#technology-stack)
- [Application architecture](#application-architecture)
- [Pages and learner workflow](#pages-and-learner-workflow)
- [External data and AI providers](#external-data-and-ai-providers)
- [Local development](#local-development)
- [Configuration](#configuration)
- [API overview](#api-overview)
- [Testing and production build](#testing-and-production-build)
- [Privacy and security considerations](#privacy-and-security-considerations)
- [Known limitations](#known-limitations)
- [Project layout](#project-layout)

## What the application does

MediNova brings together four learning experiences:

1. **Practice room** — interview a fictional patient, review simulated investigations, enter a working impression and plan, and receive a cited assessment against retrieved public guidance.
2. **Scientific discussion** — extract text from uploaded PDFs, retrieve relevant passages, and generate a source-cited, three-doctor discussion.
3. **Material case generator** — use passages from uploaded learning material to generate a fictional interview case and text-only simulated lab reports, with links back to the supporting document pages.
4. **Image and laboratory-report assessments** — interpret published medical images from Open-i or structured CBC results from the HL7 FHIR examples, submit a written response, and receive appropriately labelled AI educational feedback.

The app is designed for practice, not for recording patient encounters. There is no user account system or persistent application database.

## Technology stack

| Area | Technology | Responsibility |
|---|---|---|
| UI | React | Page composition, interactive forms, simulation state, and result rendering |
| Build and development server | Vite | Local development, hot module replacement, and optimized production assets |
| Language and modules | JavaScript ES modules | Frontend and Node.js backend implementation |
| Backend | Node.js built-in HTTP server | API routes, input checks, external requests, prompt construction, and AI-provider calls |
| PDF text extraction | PDF.js (`pdfjs-dist`) | Reads selectable text from uploaded PDF pages in the browser |
| OCR | Tesseract.js | Runs English OCR in the browser when a PDF page has little or no extractable text |
| Patient voice | Web Speech API | Browser-native text-to-speech for simulated patient speech; speech recognition is used where supported |
| Styling | CSS | Responsive, white-and-red medical-learning interface |
| AI feedback and generation | Ollama Cloud chat API (configured Gemma model) | Case generation, material-based generation, and supported assessment flows |
| Optional AI feedback | Anthropic Messages API (Claude) | Laboratory report assessment when `ANTHROPIC_API_KEY` is configured |
| Clinical image search | Open-i API | Published medical-image metadata and image URLs |
| Laboratory example | HL7 FHIR R5 | Public General Health Profile `DiagnosticReport` and linked CBC `Observation` resources |

The frontend uses the browser's built-in APIs and talks to the local Node backend over HTTP. No frontend framework router, database server, authentication provider, or custom machine-learning model is part of the current stack.

## Application architecture

```text
Browser (React + Vite)
  ├─ Practice room, PDF workspaces, image assessment, report assessment
  ├─ PDF.js extraction and Tesseract.js OCR run in the browser
  └─ JSON requests ─────────────────────────────────────────┐
                                                            v
Local Node.js API (backend/server.mjs)
  ├─ Validates request shape and applies educational safety prompts
  ├─ Keeps temporary case, document, image, and report sessions in memory
  ├─ Calls configured AI provider(s)
  └─ Retrieves public data from Open-i, HL7 FHIR, and guideline pages
```

The Node server uses in-memory `Map` collections for active sessions. Restarting it clears these sessions. Uploaded-PDF passage data is held in server memory for the document session; extracted text is sent to the configured AI provider when the learner requests generation or discussion.

## Pages and learner workflow

### Practice room — `/`

- Loads a generated fictional adult case.
- Presents the patient's opening statement and supports browser text-to-speech.
- Lets the learner ask questions and records the interview exchange.
- Accepts free-text simulated investigation and medicine orders, a working impression, and a clinical plan.
- On assessment, retrieves the case's official guideline URLs, asks the configured Gemma model for a structured assessment, and displays linked evidence.
- Includes a separately labelled assessment of a fictional pharmacy-suggested medicine already taken by the patient. The assessment can report `appropriate`, `potentially_inappropriate`, or `cannot_determine`; it is not a real medication review.

### Scientific discussion — `/discussion`

- Accepts up to three PDFs, with each file limited to 15 MB and the combined upload limited to 25 MB.
- Uses PDF.js for selectable text and local, in-browser Tesseract.js OCR for scanned pages.
- Sends extracted page text to the backend for temporary indexing and passage retrieval.
- Generates a discussion among three fictional doctors. Returned statements are associated with source IDs that link back to the uploaded document and page.
- May include an arXiv paper search for the entered topic; papers are supplemental and are not the uploaded-material evidence base.

### Material case generator — `/case-generator`

- Reuses the PDF extraction and temporary indexing workflow.
- Selects representative excerpts without requiring a separate case-focus query.
- Generates one fictional patient interview, two text-only simulated lab reports, and source-page citations from the uploaded material.
- Generated lab reports are illustrative educational examples, not real laboratory results.

### Image assessment — `/image-assessment`

- Searches Open-i for published image records and displays images from Open-i's image service.
- Reveals the available caption and article context after the learner submits a written interpretation.
- Uses Gemma to compare the written response with the available published text.
- Open-i does not supply a structured, verified diagnosis for the selected image in this workflow. Feedback is labelled AI-generated and is not a definitive grade.
- Gemma receives text metadata and the learner's response; it does **not** inspect the image pixels.

### Laboratory report assessment — `/report-assessment`

- Loads the HL7 FHIR R5 General Health Profile example and follows its `DiagnosticReport` → CBC panel `Observation` → result `Observation` references.
- Displays each linked test name, value, unit, and FHIR reference range where supplied.
- Lets the learner write and submit an interpretation.
- Reveals a DiagnosticReport conclusion or FHIR Observation interpretation code only when the sample actually contains one.
- The selected HL7 example has no DiagnosticReport conclusion or linked CBC interpretation codes, so the feedback is labelled **AI-generated educational feedback — no verified report interpretation supplied**.
- Calls Claude if configured. Otherwise it uses the existing Gemma/Ollama integration and labels the provider fallback in the returned feedback.

## External data and AI providers

### Open-i

The image assessment backend calls the documented Open-i search service:

```text
GET https://openi.nlm.nih.gov/api/search?query=<search terms>
```

The implementation uses fields observed in live Open-i responses, including `list`, `uid`, `imgLarge`, `image.caption`, `image.mention`, `abstract`, `pmc_url`, `pubMed_url`, `pmid`, and `pmcid`. Image links are restricted to HTTPS URLs hosted at `openi.nlm.nih.gov` under `/imgs/`. Open-i is a search and publication-metadata source, not a structured reference-diagnosis API.

### HL7 FHIR

The report assessment loads this official FHIR R5 JSON example:

```text
https://hl7.org/fhir/diagnosticreport-example-ghp.json
```

The code selects the `DiagnosticReport` with the General Health Profile code, follows its result references to the CBC panel, and then follows the panel's `hasMember` references to individual observations. Values and ranges displayed by the UI are taken from each Observation's `valueQuantity` and `referenceRange`.

If HL7 cannot be reached or its response is incompatible, the backend loads [`backend/fhir-cbc-fallback.json`](./backend/fhir-cbc-fallback.json), a small local copy of selected values from that published example. The UI identifies the local fallback rather than presenting it as a live response.

### Ollama Cloud / Gemma

Gemma is called by the backend, never directly by the browser. The current implementation uses the Ollama Cloud chat endpoint and defaults to the model name `gemma4:31b`; the model can be configured in `backend/.env`.

### Claude

The laboratory-report assessment calls the Anthropic Messages API when `ANTHROPIC_API_KEY` is present. It uses the configured `ANTHROPIC_MODEL`, defaulting to `claude-sonnet-4-5-20250929`. If the Claude key is not configured, that feature uses Gemma as a clearly identified fallback. Other existing Gemma-powered application features continue to use the Ollama integration.

No AI provider should be treated as a source of verified clinical truth. AI-generated feedback may be incomplete or incorrect; compare it with the linked primary sources and appropriate supervision.

## Local development

### Prerequisites

- Node.js with support for ES modules and the built-in `fetch` API.
- npm.
- An Ollama Cloud API key for Gemma-powered features. A Claude API key is optional and only needed to use Claude for report-assessment feedback.

### Install dependencies

From the project root:

```powershell
npm install
```

### Configure the backend

Copy the example file and add provider credentials:

```powershell
Copy-Item backend\.env.example backend\.env
```

Edit `backend\.env` locally. Never commit it or paste provider credentials into frontend source code.

### Start the backend and frontend

Run these in separate PowerShell terminals from the project root.

**Terminal 1 — backend API:**

```powershell
$env:API_PORT = "8788"
npm run dev:api
```

**Terminal 2 — Vite frontend:**

```powershell
npm run dev -- --port 5174
```

The project has a Git-ignored local Vite setting, `.env.development.local`, that points the browser to `http://127.0.0.1:8788/api`. The workspace uses port 8788 because another MediNova backend may already be using 8787. If port 8788 is unavailable, choose another free backend port and update `VITE_API_BASE` in `.env.development.local` to match.

Open:

- App: <http://localhost:5174/>
- Lab report assessment: <http://localhost:5174/report-assessment>
- Image assessment: <http://localhost:5174/image-assessment>
- Backend health: <http://127.0.0.1:8788/api/health>

The standard `npm run dev:api` script uses the configured `API_PORT` in `backend/.env`, or port 8787 if not set. The explicit `$env:API_PORT` command above overrides it for this local workspace.

## Configuration

`backend/.env.example` documents the supported server-side values:

| Setting | Required | Purpose |
|---|---:|---|
| `API_PORT` | No | Backend listening port; defaults to 8787 |
| `OLLAMA_API_KEY` | For Gemma | Primary Ollama Cloud API key |
| `OLLAMA_API_KEY_BACKUP` | No | Optional Ollama key fallback |
| `OLLAMA_API_KEY_BACKUP_2` | No | Optional second Ollama key fallback |
| `OLLAMA_MODEL` | No | Ollama model name; defaults to `gemma4:31b` |
| `ANTHROPIC_API_KEY` | Optional | Enables Claude specifically for laboratory report assessment |
| `ANTHROPIC_MODEL` | No | Claude model name; defaults to `claude-sonnet-4-5-20250929` |

For local frontend development:

| Setting | Purpose |
|---|---|
| `VITE_API_BASE` | API base URL bundled by Vite; set in the ignored `.env.development.local` for local overrides |

Vite-prefixed variables are included in browser code at build time. **Never put secret credentials in a `VITE_*` variable.**

The health endpoint reports whether Ollama and Claude keys are configured; it does not expose their values.

## API overview

The local API is implemented in [`backend/server.mjs`](./backend/server.mjs). Requests and responses use JSON unless otherwise noted.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/health` | Check backend availability and provider configuration status |
| `GET` | `/api/cases` | Load the current practice case |
| `GET` | `/api/cases/:id` | Retrieve a generated case by ID |
| `POST` | `/api/cases/generate` | Generate another fictional practice case |
| `POST` | `/api/cases/from-material` | Generate a case from a temporary indexed PDF session |
| `POST` | `/api/discussions` | Validate and index extracted PDF pages |
| `POST` | `/api/discussions/generate` | Generate the initial source-cited discussion |
| `POST` | `/api/discussions/respond` | Continue a scientific discussion |
| `GET` | `/api/research/arxiv?q=...` | Search arXiv for supplemental research papers |
| `POST` | `/api/labs/order` | Create a fictional simulated investigation result |
| `POST` | `/api/medications/order` | Record a fictional medicine order for educational assessment |
| `POST` | `/api/evaluate` | Assess a completed practice-room session against retrieved guidance |
| `GET` | `/api/image-assessment/search?query=...` | Search Open-i and return temporary image-selection IDs |
| `POST` | `/api/image-assessment/submit` | Compare written image interpretation with Open-i publication text |
| `GET` | `/api/report-assessment/sample` | Load and normalize the official FHIR CBC example or local fallback |
| `POST` | `/api/report-assessment/submit` | Assess a written interpretation of the FHIR CBC report |

PDF discussions are kept in memory and expire after a period of inactivity. Image/report IDs are also temporary, process-local identifiers and are lost when the API restarts. These APIs are intended for local development, not direct public deployment.

## Testing and production build

Run the backend test suite:

```powershell
node --test backend\*.test.mjs
```

Create a production frontend build:

```powershell
npm run build
```

Serve the built frontend for a local preview:

```powershell
npm run preview -- --port 4173
```

The current automated tests cover case normalization, material-grounded case validation, discussion passage retrieval, Open-i response normalization, and FHIR DiagnosticReport/CBC Observation normalization and feedback shape validation.

## Privacy and security considerations

- This is a development/educational application, not a production-ready clinical service.
- The backend currently binds to `127.0.0.1`. The Vite development server binds to `0.0.0.0`; use it only on a trusted development network.
- There is no authentication, authorization, role model, tenant isolation, rate limiting, durable storage, or audit logging.
- In-memory IDs and sessions are not designed to resist hostile clients. Do not expose the API to the public internet without adding appropriate security controls.
- `backend/.env`, `.env`, and `.env.*` are ignored by Git; `*.example` templates are intentionally tracked. Check `git status` before publishing to ensure secrets have not been added elsewhere.
- Do not upload patient-identifiable, confidential, or otherwise sensitive clinical information. Extracted PDF text is sent to the configured AI provider when generation or discussion is requested.
- External services receive network requests from the backend. Review the applicable provider and source terms before using the application beyond local experimentation.
- Generated text, simulated test results, patient dialogue, and AI feedback are not validated for clinical use.
- Browser speech playback and speech recognition depend on browser/OS support, installed voices, permissions, and (for some recognition services) network availability.

Before any deployment, add authentication and authorization as appropriate, HTTPS, secure secret management, request-size and rate limits, robust privacy/data-retention controls, appropriate logging and monitoring, dependency review, and a formal clinical-safety and legal review.

## Known limitations

- AI model responses may be incomplete, inconsistent, or malformed. The backend validates expected response shapes and returns errors when essential fields are absent; this does not establish clinical correctness.
- Guideline retrieval depends on the generated case's official URLs being reachable and returning readable pages.
- The FHIR example is a standards example, not a representative real-world patient report. Some differential counts appear as both percentages and absolute counts; a reference range may only be supplied for one of the two.
- The selected FHIR `DiagnosticReport` does not include a verified clinical conclusion. The UI deliberately avoids inferring one from abnormal values.
- Open-i figure captions and article mentions may describe the surrounding publication or a multi-panel figure rather than a definitive diagnosis for the particular image.
- PDF OCR quality depends on source resolution, scan quality, and layout. Text extracted from PDFs should be checked against the original documents.
- The frontend uses small, explicit pathname checks in [`src/App.jsx`](./src/App.jsx) rather than a full routing library; unknown paths render the practice room.

## Project layout

```text
.
├── backend/
│   ├── server.mjs                 # HTTP API, AI integrations, and external data routes
│   ├── cases.mjs                  # Practice-case normalization and safe public case shape
│   ├── discussion.mjs             # PDF passage retrieval and discussion parsing
│   ├── case-generation.mjs        # Source-cited material case validation
│   ├── openi.mjs                  # Open-i response normalization and URL validation
│   ├── fhir-report.mjs            # FHIR CBC normalization and feedback validation
│   ├── fhir-cbc-fallback.json     # Local copy of selected documented FHIR CBC values
│   ├── *.test.mjs                 # Backend unit tests
│   ├── .env.example               # Safe configuration template
│   └── .env                       # Local secrets; ignored by Git
├── src/
│   ├── App.jsx                    # Minimal pathname-based page selection
│   ├── TrainingRoom.jsx           # Practice room and case debrief
│   ├── ScientificDiscussion.jsx   # PDF-backed scientific discussion
│   ├── CaseGenerator.jsx          # Material-based case generation
│   ├── ImageAssessment.jsx        # Open-i medical image assessment
│   ├── ReportAssessment.jsx       # HL7 FHIR CBC report assessment
│   ├── pdfMaterials.js            # Browser PDF.js extraction and local OCR
│   ├── styles.css                 # Shared responsive white-and-red design
│   └── main.jsx                   # React application entry point
├── .env.development.local         # Local API URL override; ignored by Git
├── .gitignore
├── index.html
├── package.json
└── package-lock.json
```

## License and third-party services

This repository does not define a project-wide open-source license in this README. Review source, package, and service terms before redistribution or deployment. Open-i, HL7 FHIR, article publishers, AI providers, and referenced clinical guidance each retain their own terms, attribution requirements, and usage policies.
