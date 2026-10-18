const guidelinePublishers = new Map([
  ['nice.org.uk', 'National Institute for Health and Care Excellence (NICE)'],
  ['www.nice.org.uk', 'National Institute for Health and Care Excellence (NICE)'],
  ['nhs.uk', 'National Health Service (NHS)'],
  ['www.nhs.uk', 'National Health Service (NHS)'],
  ['escardio.org', 'European Society of Cardiology (ESC)'],
  ['www.escardio.org', 'European Society of Cardiology (ESC)'],
  ['professional.heart.org', 'American Heart Association (AHA)'],
  ['heart.org', 'American Heart Association (AHA)'],
  ['www.heart.org', 'American Heart Association (AHA)'],
  ['ginasthma.org', 'Global Initiative for Asthma (GINA)'],
  ['www.ginasthma.org', 'Global Initiative for Asthma (GINA)'],
  ['goldcopd.org', 'Global Initiative for Chronic Obstructive Lung Disease (GOLD)'],
  ['www.goldcopd.org', 'Global Initiative for Chronic Obstructive Lung Disease (GOLD)'],
]);
const allowedAccents = new Set(['coral', 'blue', 'sage', 'plum', 'gold', 'teal']);
const allowedHairStyles = new Set(['short', 'long', 'curly', 'covered']);
const nonTextInvestigation = /\b(x-?ray|radiograph|ultrasound|sonogram|ct scan|mri|imaging|photograph|image|scan)\b/i;
const dosePattern = /\b\d+(?:\.\d+)?\s?(?:mg|mcg|micrograms?|g|ml|millilit(?:er|re)s?)\b/i;
const medicineInstructionPattern = /\b(?:dose|dosage|dosing|once|twice|daily|weekly|monthly|hourly|every\s+\d+\s*(?:hours?|days?|weeks?)|per\s+day|by\s+mouth|orally)\b/i;

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

function normalizeOrderName(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function findMatchingTest(caseFile, name) {
  const normalizedName = normalizeOrderName(name);
  return caseFile.tests.find((test) => {
    const normalizedTestName = normalizeOrderName(test.name);
    return normalizedName === normalizedTestName
      || (normalizedName.length >= 5 && normalizedTestName.includes(normalizedName));
  });
}

function normalizeQuestion(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function isOnsetTopic(topic) {
  return /\b(onset|duration|timeline|time course)\b/i.test(`${topic.id} ${topic.label}`);
}

export function matchPatientTopic(topics, question) {
  const normalizedQuestion = normalizeQuestion(question);
  const onsetQuestion = /\bhow long\b|\bsince when\b|\bhow many (?:days?|weeks?|months?|years?)\b|\b(?:onset|duration)\b|\bwhen did (?:it|this|the symptoms?) (?:first )?(?:start|begin|appear)\b|\bwhen (?:did it|did this) (?:start|begin|first appear)\b/i.test(question);
  if (onsetQuestion) {
    const onsetTopic = topics.find(isOnsetTopic);
    if (onsetTopic) return onsetTopic;
  }

  return topics.find((topic) => topic.keywords.some((keyword) => {
    const normalizedKeyword = normalizeQuestion(keyword);
    return normalizedKeyword && ` ${normalizedQuestion} `.includes(` ${normalizedKeyword} `);
  }));
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
    const publisher = guidelinePublishers.get(url.hostname);
    if (url.protocol !== 'https:' || !publisher) {
      throw new Error('AI-generated references must link to official NICE, NHS, ESC, AHA, GINA, or GOLD guidance.');
    }
    return {
      id: `R${index + 1}`,
      title: requiredText(reference.title, 'reference title', 180),
      publisher,
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

function normalizePharmacyMedicine(medicine) {
  const name = requiredText(medicine?.name, 'fictional pharmacy medicine name', 100);
  const reason = requiredText(medicine.reason, 'fictional pharmacy medicine reason', 240);
  const reportedEffect = requiredText(medicine.reportedEffect, 'fictional pharmacy medicine effect', 240);
  if ([name, reason, reportedEffect].some((value) => dosePattern.test(value) || medicineInstructionPattern.test(value))) {
    throw new Error('The fictional pharmacy medicine must not include dosing or use instructions.');
  }
  return {
    name,
    reason,
    reportedEffect,
  };
}

export function normalizeGeneratedCases(payload, batchId) {
  if (!Array.isArray(payload?.cases) || payload.cases.length < 1 || payload.cases.length > 6) {
    throw new Error('AI must generate between 1 and 6 distinct fictional practice cases.');
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
    if (!topics.some(isOnsetTopic)) {
      throw new Error('AI-generated patient cases must include an onset and duration interview topic.');
    }
    const pharmacyMedicine = normalizePharmacyMedicine(item.pharmacyMedicine);
    const medicationHistory = topics.some((topic) => (
      /\b(medicine|medication|pharmacy)\b/i.test(`${topic.id} ${topic.label}`)
      && topic.answer.toLowerCase().includes(pharmacyMedicine.name.toLowerCase())
    ));
    if (!requiredText(item.opening, 'patient opening statement', 500).toLowerCase().includes(pharmacyMedicine.name.toLowerCase())
      || !medicationHistory) {
      throw new Error('AI-generated patient speech and a medication-history topic must mention the pharmacy medicine.');
    }
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
      initials,
      accent: item.avatar.accent,
      hairStyle: item.avatar.hairStyle,
      opening: requiredText(item.opening, 'patient opening statement', 500),
      pharmacyMedicine,
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
  const opening = caseFile.opening.replace(/^doctor[,.…:\s]*/i, '').trim();
  return {
    id: caseFile.id,
    title: caseFile.title,
    category: caseFile.category,
    patient: caseFile.patient,
    age: caseFile.age,
    initials: caseFile.initials,
    accent: caseFile.accent,
    hairStyle: caseFile.hairStyle,
    opening: `Doctor, ${opening}`,
    topics: caseFile.topics,
    suggested: caseFile.suggested,
    learning: caseFile.learning,
    references: caseFile.references,
    ...(caseFile.materialCitations ? {
      acuity: caseFile.acuity,
      clinicalContext: caseFile.clinicalContext,
      materialCitations: caseFile.materialCitations,
    } : {}),
  };
}
