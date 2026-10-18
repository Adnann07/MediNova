import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeGeneratedCases } from './cases.mjs';

function makeCase(overrides = {}) {
  return {
    title: 'A fictional recurring symptom',
    category: 'Primary care',
    referencePattern: 'A fictional pattern requiring careful history.',
    clinicalContext: 'A fictional adult patient describes an intermittent symptom.',
    learning: 'Use a careful history and supervised clinical reasoning.',
    patient: { name: 'Alex Example', age: 34, pronouns: 'they/them' },
    avatar: { accent: 'teal', hairStyle: 'curly' },
    opening: 'I have had this symptom for a few days.',
    topics: Array.from({ length: 5 }, (_, index) => ({
      id: `topic-${index}`,
      label: `History area ${index}`,
      keywords: [`topic ${index}`],
      answer: `Fictional answer ${index}.`,
    })),
    suggested: ['When did this begin?', 'What makes it change?', 'What else have you noticed?'],
    tests: [
      { name: 'Text-based blood test', findings: [{ name: 'Result', value: 'Fictional text result' }], summary: 'Fictional result for practice only.' },
      { name: 'Text-based urine test', findings: [{ name: 'Finding', value: 'No significant finding reported' }], summary: 'Interpret with the full clinical context.' },
    ],
    medications: [{ name: 'Fictional generic option', indication: 'Optional educational discussion only.' }],
    references: [{ title: 'Relevant NICE guidance', url: 'https://www.nice.org.uk/guidance/ng000' }],
    ...overrides,
  };
}

function makeBatch(overrides = {}) {
  return { cases: [makeCase(overrides), ...Array.from({ length: 2 }, (_, index) => makeCase({
    title: `Different fictional case ${index + 1}`,
    referencePattern: `Different fictional pattern ${index + 1}`,
  }))] };
}

test('normalizes a batch of AI-created adult cases and assigns unique case IDs', () => {
  const cases = normalizeGeneratedCases(makeBatch(), 'batch1234');
  assert.equal(cases.length, 3);
  assert.equal(cases[0].id, 'batch1234-1-a-fictional-recurring-symptom');
  assert.equal(cases[0].initials, 'AE');
  assert.equal(cases[0].references[0].id, 'R1');
  assert.equal(cases[0].tests[0].findings[0].value, 'Fictional text result');
});

test('normalizes one AI-created case for on-demand case generation', () => {
  const cases = normalizeGeneratedCases({ cases: [makeCase()] }, 'singlecase');
  assert.equal(cases.length, 1);
  assert.equal(cases[0].id, 'singlecase-1-a-fictional-recurring-symptom');
});

test('rejects image-based investigations', () => {
  assert.throws(
    () => normalizeGeneratedCases(makeBatch({
      tests: [
        { name: 'Chest X-ray', findings: [{ name: 'Report', value: 'Fictional finding' }], summary: 'Text.' },
        { name: 'Text-based urine test', findings: [{ name: 'Finding', value: 'None' }], summary: 'Text.' },
      ],
    }), 'batch1234'),
    /text-based/,
  );
});

test('rejects references outside NICE and NHS', () => {
  assert.throws(
    () => normalizeGeneratedCases(makeBatch({
      references: [{ title: 'Untrusted source', url: 'https://example.com/guidance' }],
    }), 'batch1234'),
    /NICE or NHS/,
  );
});

test('rejects generated medication dose details', () => {
  assert.throws(
    () => normalizeGeneratedCases(makeBatch({
      medications: [{ name: 'Example medicine 5 mg', indication: 'Optional educational discussion.' }],
    }), 'batch1234'),
    /must not include doses/,
  );
});

test('rejects cases for minors', () => {
  assert.throws(
    () => normalizeGeneratedCases(makeBatch({
      patient: { name: 'Alex Example', age: 16, pronouns: 'they/them' },
    }), 'batch1234'),
    /adult patients/,
  );
});
