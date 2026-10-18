const trustedHosts = new Set(['nice.org.uk', 'www.nice.org.uk', 'nhs.uk', 'www.nhs.uk']);
const allowedAccents = new Set(['coral', 'blue', 'sage', 'plum', 'gold', 'teal']);
const allowedHairStyles = new Set(['short', 'long', 'curly', 'covered']);
const nonTextInvestigation = /\b(x-?ray|radiograph|ultrasound|sonogram|ct scan|mri|imaging|photograph|image|scan)\b/i;
const dosePattern = /\b\d+(?:\.\d+)?\s?(?:mg|mcg|micrograms?|g|ml|millilit(?:er|re)s?)\b/i;

function requiredText(value, field, maximum = 500) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > maximum) {
    throw new Error(`AI-generated case has an invalid ${field}.`);
  }
  return value.trim();
}

function safeId(value, fallback) {
  const slug = value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 36);
  return slug || fallback;
}

function normalizeReferences(references) {
  if (!Array.isArray(references) || references.length < 1 || references.length > 3) {
    throw new Error('AI-generated case must include 1-3 clinical references.');
  }
  return references.map((reference, index) => {
    let url;
    try {
      url = new URL(requiredText(reference?.url, 'reference URL', 400));
    } catch {
      throw new Error('AI-generated case contains an invalid clinical reference URL.');
    }
    if (url.protocol !== 'https:' || !trustedHosts.has(url.hostname)) {
      throw new Error('AI-generated references must link to NICE or NHS guidance.');
    }
    return {
      id: `R${index + 1}`,
      title: requiredText(reference.title, 'reference title', 180),
      publisher: url.hostname.includes('nice.org.uk') ? 'National Institute for Health and Care Excellence (NICE)' : 'National Health Service (NHS)',
      url: url.href,
    };
  });
}

function normalizeTopic(topic, index) {
  if (!Array.isArray(topic?.keywords) || topic.keywords.length < 1 || topic.keywords.length > 8) {
    throw new Error('AI-generated patient topic has invalid question keywords.');
  }
  return {
    id: safeId(requiredText(topic.id, 'patient topic id', 80), `topic-${index + 1}`),
    label: requiredText(topic.label, 'patient topic label', 100),
    keywords: topic.keywords.map((keyword) => requiredText(keyword, 'patient topic keyword', 40).toLowerCase()),
    answer: requiredText(topic.answer, 'patient answer', 700),
  };
}

function normalizeTest(test, index) {
  const name = requiredText(test?.name, 'investigation name', 120);
  if (nonTextInvestigation.test(name)) {
    throw new Error('AI-generated investigations must be text-based; image-based tests are not supported.');
  }
  if (!Array.isArray(test.findings) || test.findings.length < 1 || test.findings.length > 5) {
    throw new Error('AI-generated text investigations must include 1-5 textual findings.');
  }
  return {
    id: safeId(name, `test-${index + 1}`),
    name,
    findings: test.findings.map((finding) => ({
      name: requiredText(finding?.name, 'finding label', 90),
      value: requiredText(finding?.value, 'textual finding', 240),
    })),
    expectedSummary: requiredText(test.summary, 'investigation summary', 600),
  };
}

function normalizeMedication(medication, index) {
  const name = requiredText(medication?.name, 'medicine name', 100);
  const indication = requiredText(medication?.indication, 'medicine rationale', 240);
  if (dosePattern.test(name) || dosePattern.test(indication)) {
    throw new Error('AI-generated medicine options must not include doses.');
  }
  return {
    id: safeId(name, `medicine-${index + 1}`),
    name,
    indication,
  };
}

export function normalizeGeneratedCases(payload, batchId) {
  if (!Array.isArray(payload?.cases) || payload.cases.length < 3 || payload.cases.length > 6) {
    throw new Error('AI must generate between 3 and 6 distinct fictional practice cases.');
  }

  const cases = payload.cases.map((item, index) => {
    if (!item?.avatar || !allowedAccents.has(item.avatar.accent) || !allowedHairStyles.has(item.avatar.hairStyle)) {
      throw new Error('AI-generated case has an unsupported avatar design.');
    }
    if (!Array.isArray(item.topics) || item.topics.length < 5 || item.topics.length > 9) {
      throw new Error('AI-generated case must include 5-9 interview topics.');
    }
    if (!Array.isArray(item.suggested) || item.suggested.length < 3 || item.suggested.length > 5) {
      throw new Error('AI-generated case must include 3-5 suggested interview questions.');
    }
    if (!Array.isArray(item.tests) || item.tests.length < 2 || item.tests.length > 5) {
      throw new Error('AI-generated case must include 2-5 text-based investigations.');
    }
    if (!Array.isArray(item.medications) || item.medications.length > 5) {
      throw new Error('AI-generated case has invalid optional medicine choices.');
    }

    const title = requiredText(item.title, 'case title', 140);
    const patientName = requiredText(item.patient?.name, 'patient name', 100);
    const caseId = `${batchId}-${index + 1}-${safeId(title, 'practice-case')}`;
    const initials = patientName.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
    const topics = item.topics.map(normalizeTopic);
    if (new Set(topics.map((topic) => topic.id)).size !== topics.length) {
      throw new Error('AI-generated case contains duplicate interview topic IDs.');
    }
    const tests = item.tests.map(normalizeTest);
    if (new Set(tests.map((test) => test.id)).size !== tests.length) {
      throw new Error('AI-generated case contains duplicate investigation names.');
    }
    const medications = item.medications.map(normalizeMedication);
    if (new Set(medications.map((medication) => medication.id)).size !== medications.length) {
      throw new Error('AI-generated case contains duplicate medicine choices.');
    }

    return {
      id: caseId,
      title,
      category: requiredText(item.category, 'clinical category', 80),
      referencePattern: requiredText(item.referencePattern, 'hidden reference pattern', 350),
      clinicalContext: requiredText(item.clinicalContext, 'fictional case context', 900),
      learning: requiredText(item.learning, 'learning note', 500),
      patient: patientName,
      age: Number.isInteger(item.patient.age) && item.patient.age >= 18 && item.patient.age <= 90
        ? item.patient.age
        : (() => { throw new Error('AI-generated cases must feature adult patients aged 18-90.'); })(),
      pronouns: requiredText(item.patient.pronouns, 'patient pronouns', 40),
      initials,
      accent: item.avatar.accent,
      hairStyle: item.avatar.hairStyle,
      opening: requiredText(item.opening, 'patient opening statement', 500),
      topics,
      suggested: item.suggested.map((question) => requiredText(question, 'suggested question', 160)),
      tests,
      medications,
      references: normalizeReferences(item.references),
    };
  });

  const normalizedTitles = new Set(cases.map((item) => item.title.toLowerCase()));
  const normalizedPatterns = new Set(cases.map((item) => item.referencePattern.toLowerCase()));
  if (normalizedTitles.size !== cases.length || normalizedPatterns.size !== cases.length) {
    throw new Error('AI-generated cases must have distinct titles and clinical patterns.');
  }
  return cases;
}

export function toPublicCase(caseFile) {
  return {
    id: caseFile.id,
    title: caseFile.title,
    category: caseFile.category,
    patient: caseFile.patient,
    age: caseFile.age,
    pronouns: caseFile.pronouns,
    initials: caseFile.initials,
    accent: caseFile.accent,
    hairStyle: caseFile.hairStyle,
    opening: caseFile.opening,
    topics: caseFile.topics,
    suggested: caseFile.suggested,
    learning: caseFile.learning,
    tests: caseFile.tests.map(({ id, name }) => ({ id, name })),
    medications: caseFile.medications,
  };
}
