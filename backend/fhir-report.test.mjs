import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCbcDiagnosticReport, normalizeLocalCbcSample, normalizeReportFeedback } from './fhir-report.mjs';

test('normalizes the official HL7 GHP DiagnosticReport and linked CBC Observations', () => {
  const report = normalizeCbcDiagnosticReport({
    resourceType: 'Bundle',
    entry: [
      {
        fullUrl: 'https://example.com/base/DiagnosticReport/ghp',
        resource: {
          resourceType: 'DiagnosticReport',
          id: 'ghp',
          status: 'final',
          code: { coding: [{ system: 'http://acme.com/labs/reports', code: 'GHP', display: 'General Health Profile' }] },
          result: [{ reference: 'Observation/p2' }],
        },
      },
      {
        fullUrl: 'https://example.com/base/Observation/p2',
        resource: {
          resourceType: 'Observation',
          id: 'p2',
          code: { coding: [{ system: 'http://loinc.org', code: '58410-2', display: 'Complete blood count panel' }] },
          hasMember: [{ reference: 'Observation/r1' }, { reference: 'Observation/r3' }],
        },
      },
      {
        fullUrl: 'https://example.com/base/Observation/r1',
        resource: {
          resourceType: 'Observation',
          id: 'r1',
          code: { text: 'Haemoglobin' },
          valueQuantity: { value: 176, unit: 'g/L' },
          referenceRange: [{ low: { value: 135, unit: 'g/L' }, high: { value: 180, unit: 'g/L' } }],
        },
      },
      {
        fullUrl: 'https://example.com/base/Observation/r3',
        resource: {
          resourceType: 'Observation',
          id: 'r3',
          code: { text: 'Haematocrit' },
          valueQuantity: { value: 55, unit: '%' },
          referenceRange: [{ low: { value: 38, unit: '%' }, high: { value: 52, unit: '%' } }],
          interpretation: [{ coding: [{ display: 'High' }] }],
        },
      },
    ],
  });
  const [haemoglobin, haematocrit] = report.observations;
  assert.equal(report.id, 'ghp');
  assert.equal(report.referenceInterpretation, null);
  assert.equal(haemoglobin.name, 'Haemoglobin');
  assert.equal(haemoglobin.value, 176);
  assert.equal(haemoglobin.unit, 'g/L');
  assert.deepEqual(haemoglobin.referenceRanges, ['135–180 g/L']);
  assert.deepEqual(haematocrit.interpretation, ['High']);
});

test('keeps absent DiagnosticReport conclusions absent rather than inventing a verified interpretation', () => {
  const report = normalizeCbcDiagnosticReport({
    resourceType: 'Bundle',
    entry: [
      { resource: { resourceType: 'DiagnosticReport', id: 'ghp', status: 'final', code: { coding: [{ code: 'GHP', display: 'General Health Profile' }] }, result: [{ reference: 'Observation/p2' }] } },
      { resource: { resourceType: 'Observation', id: 'p2', code: { coding: [{ code: '58410-2', display: 'CBC' }] }, hasMember: [{ reference: 'Observation/r1' }] } },
      { resource: { resourceType: 'Observation', id: 'r1', code: { text: 'Haemoglobin' }, valueQuantity: { value: 176, unit: 'g/L' } } },
    ],
  });
  assert.equal(report.referenceInterpretation, null);
});

test('validates the documented local fallback shape', () => {
  const fallback = normalizeLocalCbcSample({
    id: 'official-example-fallback',
    status: 'final',
    title: 'General Health Profile',
    panel: 'CBC',
    observations: [{ name: 'Haemoglobin', value: 176, unit: 'g/L', referenceRanges: ['135–180 g/L'] }],
  });
  assert.equal(fallback.observations[0].value, 176);
  assert.equal(fallback.observations[0].referenceRanges[0], '135–180 g/L');
});

test('accepts common Gemini/Gemma JSON field naming while requiring actual feedback', () => {
  const feedback = normalizeReportFeedback({
    overall_feedback: 'Compare each result with its reference interval.',
    strengths: ['You identified the out-of-range result.'],
    nextConsiderations: ['State uncertainty explicitly.'],
  });
  assert.equal(feedback.feedback, 'Compare each result with its reference interval.');
  assert.equal(feedback.nextConsiderations[0], 'State uncertainty explicitly.');
  assert.throws(() => normalizeReportFeedback({ feedback: '', strengths: [], next_considerations: [] }), /incomplete/);
});
