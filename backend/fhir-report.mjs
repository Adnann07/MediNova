function conceptText(concept) {
  if (typeof concept?.text === 'string' && concept.text.trim()) return concept.text.trim();
  const coding = concept?.coding?.find((item) => typeof item.display === 'string' && item.display.trim());
  return coding?.display?.trim() || '';
}

function quantityText(quantity) {
  if (!quantity || typeof quantity.value !== 'number') return null;
  return { value: quantity.value, unit: quantity.unit || quantity.code || '' };
}

function rangeText(range) {
  if (typeof range?.text === 'string' && range.text.trim()) return range.text.trim();
  const low = quantityText(range?.low);
  const high = quantityText(range?.high);
  if (low && high) return `${low.value}–${high.value} ${low.unit || high.unit}`.trim();
  if (low) return `≥ ${low.value} ${low.unit}`.trim();
  if (high) return `≤ ${high.value} ${high.unit}`.trim();
  return null;
}

function observationRow(observation) {
  const name = conceptText(observation.code);
  const quantity = quantityText(observation.valueQuantity);
  const value = quantity
    ? { ...quantity }
    : typeof observation.valueString === 'string'
      ? { value: observation.valueString, unit: '' }
      : observation.valueCodeableConcept
        ? { value: conceptText(observation.valueCodeableConcept), unit: '' }
        : null;
  if (!name || !value) return null;
  return {
    name,
    value: value.value,
    unit: value.unit,
    referenceRanges: Array.isArray(observation.referenceRange)
      ? observation.referenceRange.map(rangeText).filter(Boolean)
      : [],
    interpretation: Array.isArray(observation.interpretation)
      ? observation.interpretation.map(conceptText).filter(Boolean)
      : [],
  };
}

export function normalizeCbcDiagnosticReport(bundle) {
  if (bundle?.resourceType !== 'Bundle' || !Array.isArray(bundle.entry)) {
    throw new Error('The FHIR CBC response was not a Bundle with entries.');
  }
  const resources = new Map();
  for (const entry of bundle.entry) {
    const resource = entry.resource;
    if (typeof resource?.resourceType !== 'string' || typeof resource.id !== 'string') continue;
    resources.set(`${resource.resourceType}/${resource.id}`, resource);
    if (typeof entry.fullUrl === 'string') resources.set(entry.fullUrl, resource);
  }
  const report = [...resources.values()].find((resource) => (
    resource.resourceType === 'DiagnosticReport'
    && (resource.code?.coding?.some((coding) => coding.code === 'GHP') || conceptText(resource.code).toLowerCase().includes('general health profile'))
  ));
  if (!report) throw new Error('The official FHIR example did not include the expected General Health Profile DiagnosticReport.');
  const resultResources = (report.result || [])
    .map((result) => resources.get(result.reference) || resources.get(result.reference?.replace(/^https?:\/\/[^/]+\/[^/]+\//, '')))
    .filter((resource) => resource?.resourceType === 'Observation');
  const cbcPanel = resultResources.find((observation) => (
    observation.code?.coding?.some((coding) => coding.code === '58410-2')
    || /complete blood count|\bcbc\b/i.test(conceptText(observation.code))
  ));
  if (!cbcPanel) throw new Error('The official FHIR DiagnosticReport did not reference a CBC panel.');
  const observations = (cbcPanel.hasMember || [])
    .map((member) => resources.get(member.reference) || resources.get(member.reference?.replace(/^https?:\/\/[^/]+\/[^/]+\//, '')))
    .filter((resource) => resource?.resourceType === 'Observation')
    .map(observationRow)
    .filter(Boolean);
  if (!observations.length) throw new Error('The official FHIR CBC panel did not include any measurable Observation resources.');
  return {
    id: report.id,
    status: report.status || 'unknown',
    title: conceptText(report.code) || 'General Health Profile',
    panel: conceptText(cbcPanel.code) || 'Complete blood count (CBC)',
    referenceInterpretation: typeof report.conclusion === 'string' && report.conclusion.trim()
      ? report.conclusion.trim()
      : null,
    observations,
  };
}

export function normalizeLocalCbcSample(sample) {
  if (!sample || typeof sample.id !== 'string' || !Array.isArray(sample.observations) || !sample.observations.length) {
    throw new Error('The local FHIR CBC sample is invalid.');
  }
  return {
    id: sample.id,
    status: sample.status,
    title: sample.title,
    panel: sample.panel,
    referenceInterpretation: sample.referenceInterpretation || null,
    observations: sample.observations.map((item) => ({
      name: item.name,
      value: item.value,
      unit: item.unit || '',
      referenceRanges: Array.isArray(item.referenceRanges) ? item.referenceRanges : [],
      interpretation: Array.isArray(item.interpretation) ? item.interpretation : [],
    })),
  };
}

export function normalizeReportFeedback(evaluation) {
  const feedback = evaluation?.feedback ?? evaluation?.overall_feedback ?? evaluation?.summary;
  const rawStrengths = evaluation?.strengths ?? [];
  const rawNext = evaluation?.next_considerations ?? evaluation?.nextConsiderations ?? evaluation?.next_steps ?? [];
  const validList = (value) => Array.isArray(value)
    && value.length <= 4
    && value.every((item) => typeof item === 'string' && item.trim() && item.length <= 500);
  if (typeof feedback !== 'string' || !feedback.trim() || feedback.length > 1600
    || !validList(rawStrengths) || !validList(rawNext)) {
    throw new Error('The AI provider returned incomplete laboratory report feedback.');
  }
  return {
    feedback: feedback.trim(),
    strengths: rawStrengths.map((item) => item.trim()),
    nextConsiderations: rawNext.map((item) => item.trim()),
  };
}
