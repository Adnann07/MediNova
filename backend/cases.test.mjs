import test from 'node:test';
import assert from 'node:assert/strict';
import { findMatchingTest, matchPatientTopic, normalizeGeneratedCases, toPublicCase } from './cases.mjs';

function makeCase(overrides = {}) {
  return {
    title: 'A fictional recurring symptom',
    category: 'Primary care',
    referencePattern: 'A fictional pattern requiring careful history.',
    clinicalContext: 'A fictional adult patient describes an intermittent symptom.',
    learning: 'Use a careful history and supervised clinical reasoning.',
    patient: { name: 'Alex Example', age: 34 },
    avatar: { accent: 'teal', hairStyle: 'curly' },
    opening: 'I have had this symptom for a few days.',
    topics: Array.from({ length: 5 }, (_, index) => ({
      id: index === 0 ? 'onset' : `topic-${index}`,
      label: index === 0 ? 'Onset and duration' : `History area ${index}`,
      keywords: index === 0 ? ['how long', 'when', 'start', 'since'] : [`topic ${index}`],
      answer: index === 0 ? 'It started a few days ago.' : `Fictional answer ${index}.`,
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
  assert.equal(toPublicCase(cases[0]).opening, 'Doctor, I have had this symptom for a few days.');
});

test('normalizes one AI-created case for on-demand case generation', () => {
  const cases = normalizeGeneratedCases({ cases: [makeCase()] }, 'singlecase');
  assert.equal(cases.length, 1);
  assert.equal(cases[0].id, 'singlecase-1-a-fictional-recurring-symptom');
});

test('does not require or expose patient pronouns', () => {
  const [caseFile] = normalizeGeneratedCases({
    cases: [makeCase({ patient: { name: 'Alex Example', age: 34, pronouns: 'they/them' } })],
  }, 'pronouns');
  assert.equal(Object.hasOwn(caseFile, 'pronouns'), false);
});

test('keeps answer-key test and medicine options private until debrief', () => {
  const [caseFile] = normalizeGeneratedCases({ cases: [makeCase()] }, 'private');
  const publicCase = toPublicCase(caseFile);
  assert.equal(Object.hasOwn(publicCase, 'tests'), false);
  assert.equal(Object.hasOwn(publicCase, 'medications'), false);
});

test('adds the Doctor greeting once to patient opening speech', () => {
  const [caseFile] = normalizeGeneratedCases({
    cases: [makeCase({ opening: 'Doctor... I have felt tired this week.' })],
  }, 'opening');
  assert.equal(toPublicCase(caseFile).opening, 'Doctor, I have felt tired this week.');
});

test('routes natural duration questions to the onset and duration answer', () => {
  const [caseFile] = normalizeGeneratedCases({ cases: [makeCase()] }, 'duration');
  const onset = caseFile.topics[0];
  for (const question of [
    'How long has it been since you first noticed this issue?',
    'When did this start?',
    'How many days have you had these symptoms?',
    'What is the duration of the problem?',
  ]) {
    assert.equal(matchPatientTopic(caseFile.topics, question), onset, question);
  }
});

test('matches patient keywords as whole words instead of accidental substrings', () => {
  const topics = [{ id: 'pain', label: 'Pain', keywords: ['pain'], answer: 'Fictional.' }];
  assert.equal(matchPatientTopic(topics, 'I enjoy painting.'), undefined);
  assert.equal(matchPatientTopic(topics, 'I have pain.'), topics[0]);
});

test('matches free-text lab orders without exposing an order menu', () => {
  const [caseFile] = normalizeGeneratedCases({ cases: [makeCase()] }, 'orders');
  assert.equal(findMatchingTest(caseFile, 'Text-based blood test').id, caseFile.tests[0].id);
  assert.equal(findMatchingTest(caseFile, 'unavailable test'), undefined);
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
      patient: { name: 'Alex Example', age: 16 },
    }), 'batch1234'),
    /adult patients/,
  );
});
