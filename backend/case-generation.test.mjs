import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMaterialGeneratedCase } from './case-generation.mjs';

const sources = [
  { id: 'S1', documentName: 'teaching.pdf', pageNumber: 3, text: 'Source passage about symptoms and case details.' },
  { id: 'S2', documentName: 'teaching.pdf', pageNumber: 4, text: 'Source passage about fictional investigations.' },
];

function makeGeneratedCase(overrides = {}) {
  const topics = [
    { id: 'onset', label: 'Onset and duration', keywords: ['how long', 'when', 'start', 'since'], answer: 'It began this morning.', source_ids: ['S1'] },
    { id: 'medication-history', label: 'Pharmacy medicine history', keywords: ['pharmacy', 'medicine', 'medication'], answer: 'I took paracetamol after a pharmacy suggestion.', source_ids: ['S1'] },
    ...Array.from({ length: 3 }, (_, index) => ({
      id: `topic-${index}`,
      label: `History area ${index}`,
      keywords: [`area ${index}`],
      answer: `Fictional answer ${index}.`,
      source_ids: ['S1'],
    })),
  ];
  const tests = [
    { name: 'Full blood count', findings: [{ name: 'Example finding', value: 'Fictional illustrative value' }], summary: 'Illustrative fictional result only.', source_ids: ['S2'] },
    { name: 'Second text-only test', findings: [{ name: 'Example result', value: 'Fictional illustrative value' }], summary: 'Illustrative fictional result only.', source_ids: ['S2'] },
  ];
  return {
    title: 'Fictional source-grounded case',
    category: 'Haematology',
    acuity: 'routine',
    referencePattern: 'A fictional educational case pattern.',
    reference_pattern_citation_ids: ['S1'],
    clinicalContext: 'A fictional adult scenario based on the retrieved source passages.',
    learning: 'Fictional educational practice only; seek qualified supervision.',
    patient: { name: 'Alex Example', age: 34 },
    avatar: { accent: 'teal', hairStyle: 'short' },
    opening: 'I have felt unusually tired recently, and took paracetamol after a pharmacy suggestion.',
    pharmacyMedicine: {
      name: 'paracetamol',
      reason: 'I hoped it might ease how I feel.',
      reportedEffect: 'It has not made much difference.',
    },
    opening_citation_ids: ['S1'],
    context_citation_ids: ['S1'],
    learning_citation_ids: ['S1'],
    topics,
    suggested: ['When did this start?', 'What else have you noticed?', 'Have you felt different recently?'],
    tests,
    medications: [],
    references: [{ title: 'NICE guidance for fictional case testing', url: 'https://www.nice.org.uk/guidance/ng000' }],
    ...overrides,
  };
}

function asJson(caseData) {
  return JSON.stringify({ cases: [caseData] });
}

test('parses a source-cited fictional case and returns the two simulated lab reports', () => {
  const result = parseMaterialGeneratedCase(asJson(makeGeneratedCase()), sources, 'material01');
  assert.equal(result.case.title, 'Fictional source-grounded case');
  assert.equal(result.case.materialCitations.opening[0], 'S1');
  assert.equal(result.case.materialCitations.topics.length, 5);
  assert.equal(result.tests.length, 2);
  assert.equal(result.tests[0].sourceIds[0], 'S2');
  assert.equal(result.sources[0].documentName, 'teaching.pdf');
  assert.equal(result.sources.length, 2);
  assert.equal(Object.hasOwn(result.caseFile, 'materialSources'), false);
});

test('rejects case content that cites a passage outside the retrieved set', () => {
  const item = makeGeneratedCase();
  item.tests[0].source_ids = ['S99'];
  assert.throws(
    () => parseMaterialGeneratedCase(asJson(item), sources, 'material02'),
    /unsupported source citations/,
  );
});

test('rejects material cases without exactly two investigations', () => {
  const item = makeGeneratedCase({ tests: [makeGeneratedCase().tests[0]] });
  assert.throws(
    () => parseMaterialGeneratedCase(asJson(item), sources, 'material03'),
    /exactly two/,
  );
});

test('rejects material cases without a supported acuity label', () => {
  const item = makeGeneratedCase({ acuity: 'severe' });
  assert.throws(
    () => parseMaterialGeneratedCase(asJson(item), sources, 'material04'),
    /acuity/,
  );
});
