import { normalizeGeneratedCases, toPublicCase } from './cases.mjs';

function invalid(message) {
  throw Object.assign(new Error(message), { status: 422 });
}

function citationIds(value, sourceIds, field) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 3
    || value.some((id) => typeof id !== 'string' || !sourceIds.has(id))) {
    invalid(`Generated case has missing or unsupported source citations for ${field}.`);
  }
  return [...new Set(value)];
}

export function parseMaterialGeneratedCase(text, sources, batchId) {
  let payload;
  try {
    payload = JSON.parse(text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''));
  } catch {
    invalid('Gemma returned unreadable case JSON. Please try again.');
  }
  if (Array.isArray(payload?.cases) && payload.cases.length === 0) {
    invalid('The uploaded passages do not support a coherent case for this focus. Try another focus or upload more relevant material.');
  }
  if (!Array.isArray(payload?.cases) || payload.cases.length !== 1) {
    invalid('Gemma must return exactly one fictional case.');
  }

  const item = payload.cases[0];
  if (!['urgent', 'routine'].includes(item?.acuity)) {
    invalid('Generated case acuity must be marked urgent or routine.');
  }
  if (!Array.isArray(item.topics) || item.topics.length < 5 || item.topics.length > 9) {
    invalid('Generated case must include 5-9 interview topics.');
  }
  if (!Array.isArray(item.tests) || item.tests.length !== 2) {
    invalid('The generated case must include exactly two text-only investigations.');
  }
  if (item.tests.some((investigation) => !Array.isArray(investigation.findings)
    || investigation.findings.length < 1
    || investigation.findings.length > 3
    || investigation.findings.some((finding) => !/\b(fictional|illustrative|simulated)\b/i.test(finding?.value || '')))) {
    invalid('Every generated lab finding must be explicitly marked fictional, illustrative, or simulated.');
  }
  const sourceIds = new Set(sources.map(({ id }) => id));
  const citations = {
    opening: citationIds(item.opening_citation_ids, sourceIds, 'the opening symptoms'),
    clinicalContext: citationIds(item.context_citation_ids, sourceIds, 'the clinical context'),
    learning: citationIds(item.learning_citation_ids, sourceIds, 'the learning note'),
    referencePattern: citationIds(item.reference_pattern_citation_ids, sourceIds, 'the hidden reference pattern'),
    topics: item.topics.map((topic, index) => citationIds(topic?.source_ids, sourceIds, `interview topic ${index + 1}`)),
    tests: item.tests.map((test, index) => citationIds(test?.source_ids, sourceIds, `investigation ${index + 1}`)),
  };
  if (!Array.isArray(citations.topics) || citations.topics.length !== item.topics.length) {
    invalid('Generated case interview topics need source citations.');
  }

  const [caseFile] = normalizeGeneratedCases(payload, batchId);
  caseFile.acuity = item.acuity;
  caseFile.materialCitations = citations;
  const materialSources = sources.map(({ id, documentName, pageNumber, text }) => ({
    id,
    documentName,
    pageNumber,
    text,
  }));
  return {
    caseFile,
    case: toPublicCase(caseFile),
    tests: caseFile.tests.map(({ id, name, findings, expectedSummary }, index) => ({
      id,
      name,
      findings,
      summary: expectedSummary,
      sourceIds: citations.tests[index],
    })),
    sources: materialSources,
  };
}
