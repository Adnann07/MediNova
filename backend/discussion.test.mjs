import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createKnowledgeChunks,
  normalizeKnowledgeBase,
  parseDoctorDiscussion,
  retrieveRepresentativePassages,
  retrieveRelevantPassages,
} from './discussion.mjs';

const pages = [
  {
    documentName: 'cardiology.pdf',
    pageNumber: 3,
    text: 'Acute chest pain requires structured assessment of symptom onset, character, radiation, associated symptoms, and cardiovascular risk. An electrocardiogram and serial cardiac biomarkers may inform the evaluation.',
  },
  {
    documentName: 'respiratory.pdf',
    pageNumber: 8,
    text: 'Asthma is characterized by variable respiratory symptoms and variable expiratory airflow. Assess triggers, nocturnal symptoms, inhaler technique, and lung function.',
  },
];

test('normalizes uploaded pages and sanitizes document names', () => {
  const result = normalizeKnowledgeBase({ pages: [{ ...pages[0], documentName: '../chest:guide.pdf' }] });
  assert.equal(result[0].documentName, '.._chest_guide.pdf');
  assert.equal(result[0].pageNumber, 3);
});

test('rejects oversized and duplicate page payloads', () => {
  assert.throws(
    () => normalizeKnowledgeBase({ pages: [{ ...pages[0], text: 'x'.repeat(10_001) }] }),
    /readable text/,
  );
  assert.throws(
    () => normalizeKnowledgeBase({ pages: [pages[0], pages[0]] }),
    /duplicate page/,
  );
});

test('retrieval ranks passages related to the requested topic', () => {
  const chunks = createKnowledgeChunks(pages);
  const results = retrieveRelevantPassages(chunks, 'acute chest pain electrocardiogram cardiac biomarkers');
  assert.equal(results[0].documentName, 'cardiology.pdf');
  assert.equal(results[0].pageNumber, 3);
});

test('representative retrieval selects passages without requiring a user search query', () => {
  const manyPages = Array.from({ length: 5 }, (_, index) => ({
    documentName: 'teaching.pdf',
    pageNumber: index + 1,
    text: `Distinctive clinical teaching information section ${index} with evidence, symptoms, laboratory findings, and assessment details.`,
  }));
  const chunks = createKnowledgeChunks(manyPages);
  const results = retrieveRepresentativePassages(chunks, 3);
  assert.equal(results.length, 3);
  assert.equal(new Set(results.map((chunk) => chunk.pageNumber)).size, 3);
});

test('requires all three speakers and citations from retrieved sources', () => {
  const sources = [{ id: 'S1', documentName: 'guide.pdf', pageNumber: 1, text: 'Evidence excerpt.' }];
  const discussion = Array.from({ length: 9 }, (_, index) => ({
    speaker: ['clinician', 'researcher', 'reviewer'][index % 3],
    text: 'The uploaded material describes this finding.',
    citation_ids: ['S1'],
  }));
  const parsed = parseDoctorDiscussion(JSON.stringify({ discussion }), sources);
  assert.equal(parsed.discussion.length, 9);
  assert.equal(parsed.discussion[1].speaker, 'Dr. Elias Okafor');

  discussion[1].citation_ids = ['S999'];
  assert.throws(
    () => parseDoctorDiscussion(JSON.stringify({ discussion }), sources),
    /unsupported citation/,
  );
});

test('validates one-turn-per-doctor responses when the participant raises a hand', () => {
  const sources = [{ id: 'S4', documentName: 'guide.pdf', pageNumber: 2, text: 'Evidence excerpt.' }];
  const response = {
    discussion: ['clinician', 'researcher', 'reviewer'].map((speaker) => ({
      speaker,
      text: 'The source supports this point, within its stated limits.',
      citation_ids: ['S4'],
    })),
  };
  const parsed = parseDoctorDiscussion(JSON.stringify(response), sources, ['clinician', 'researcher', 'reviewer']);
  assert.deepEqual(parsed.discussion.map((turn) => turn.speaker), ['Dr. Maya Chen', 'Dr. Elias Okafor', 'Dr. Priya Shah']);
  response.discussion[2].speaker = 'clinician';
  assert.throws(
    () => parseDoctorDiscussion(JSON.stringify(response), sources, ['clinician', 'researcher', 'reviewer']),
    /invalid speaker/,
  );
});
