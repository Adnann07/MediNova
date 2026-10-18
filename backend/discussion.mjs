export const discussionDoctors = [
  { id: 'clinician', name: 'Dr. Maya Chen', role: 'Clinical perspective' },
  { id: 'researcher', name: 'Dr. Elias Okafor', role: 'Evidence synthesis' },
  { id: 'reviewer', name: 'Dr. Priya Shah', role: 'Critical appraisal' },
];

const maxPages = 80;
const maxPageCharacters = 10_000;
const maxTotalCharacters = 600_000;
const chunkWords = 180;
const overlapWords = 35;
const stopWords = new Set(['about', 'after', 'again', 'against', 'also', 'among', 'and', 'are', 'because', 'been', 'before', 'being', 'between', 'both', 'could', 'does', 'each', 'from', 'have', 'into', 'more', 'most', 'other', 'over', 'same', 'should', 'some', 'such', 'than', 'that', 'their', 'them', 'then', 'there', 'these', 'they', 'this', 'those', 'through', 'under', 'very', 'were', 'what', 'when', 'where', 'which', 'while', 'with', 'would']);

function invalid(message) {
  throw Object.assign(new Error(message), { status: 400 });
}

function tokenize(text) {
  return text.toLocaleLowerCase().match(/[\p{L}\p{N}]{2,}/gu)?.filter((word) => !stopWords.has(word)) ?? [];
}

export function normalizeKnowledgeBase(payload) {
  if (!Array.isArray(payload?.pages) || payload.pages.length < 1 || payload.pages.length > maxPages) {
    invalid(`Upload material containing between 1 and ${maxPages} pages.`);
  }

  let totalCharacters = 0;
  const seenPages = new Set();
  const pages = payload.pages.map((page) => {
    const documentName = typeof page?.documentName === 'string'
      ? page.documentName.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').trim().slice(0, 120)
      : '';
    const pageNumber = page?.pageNumber;
    const text = typeof page?.text === 'string' ? page.text.replace(/\s+/g, ' ').trim() : '';
    if (!documentName || !Number.isInteger(pageNumber) || pageNumber < 1 || !text || text.length > maxPageCharacters) {
      invalid('Each extracted page must have a document name, a valid page number, and readable text.');
    }
    const pageKey = `${documentName}\u0000${pageNumber}`;
    if (seenPages.has(pageKey)) invalid('The uploaded material contains a duplicate page.');
    seenPages.add(pageKey);
    totalCharacters += text.length;
    if (totalCharacters > maxTotalCharacters) invalid('Extracted material is too large. Keep it under 600,000 characters.');
    return { documentName, pageNumber, text };
  }).filter((page) => page.text.length >= 20);

  if (pages.length === 0 || totalCharacters < 100) {
    invalid('Not enough readable text was extracted. Try OCR again or upload a text-based PDF.');
  }
  return pages;
}

export function createKnowledgeChunks(pages) {
  const chunks = [];
  for (const page of pages) {
    const words = page.text.split(/\s+/).filter(Boolean);
    const step = chunkWords - overlapWords;
    for (let start = 0; start < words.length; start += step) {
      const text = words.slice(start, start + chunkWords).join(' ');
      if (text) chunks.push({ id: `S${chunks.length + 1}`, documentName: page.documentName, pageNumber: page.pageNumber, text });
      if (start + chunkWords >= words.length) break;
    }
  }
  return chunks;
}

export function retrieveRelevantPassages(chunks, topic, limit = 6) {
  const queryTokens = tokenize(topic);
  const queryTerms = new Set(queryTokens);
  if (queryTerms.size === 0) return [];

  const tokenized = chunks.map((chunk) => tokenize(chunk.text));
  const documentFrequency = new Map();
  for (const tokens of tokenized) {
    for (const term of new Set(tokens)) documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
  }
  const averageLength = tokenized.reduce((total, tokens) => total + tokens.length, 0) / Math.max(tokenized.length, 1);
  const scored = chunks.map((chunk, index) => {
    const frequencies = new Map();
    for (const term of tokenized[index]) frequencies.set(term, (frequencies.get(term) ?? 0) + 1);
    let score = 0;
    for (const term of queryTerms) {
      const frequency = frequencies.get(term) ?? 0;
      if (!frequency) continue;
      const df = documentFrequency.get(term) ?? 0;
      const inverseFrequency = Math.log(1 + (tokenized.length - df + 0.5) / (df + 0.5));
      const lengthAdjustment = frequency + 1.2 * (1 - 0.75 + 0.75 * tokenized[index].length / Math.max(averageLength, 1));
      score += inverseFrequency * (frequency * 2.2) / lengthAdjustment;
    }
    return { chunk, score };
  }).filter((item) => item.score > 0).sort((left, right) => right.score - left.score);

  const selected = [];
  const selectedPages = new Set();
  for (const item of scored) {
    const key = `${item.chunk.documentName}\u0000${item.chunk.pageNumber}`;
    if (selectedPages.has(key)) continue;
    selected.push(item.chunk);
    selectedPages.add(key);
    if (selected.length === limit) return selected;
  }
  for (const item of scored) {
    if (selected.includes(item.chunk)) continue;
    selected.push(item.chunk);
    if (selected.length === limit) break;
  }
  return selected;
}

export function retrieveRepresentativePassages(chunks, limit = 8) {
  if (!chunks.length || limit < 1) return [];
  const tokenized = chunks.map((chunk) => tokenize(chunk.text));
  const documentFrequency = new Map();
  for (const tokens of tokenized) {
    for (const term of new Set(tokens)) documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
  }
  const scored = chunks.map((chunk, index) => {
    const uniqueTerms = new Set(tokenized[index]);
    const score = [...uniqueTerms].reduce((total, term) => (
      total + Math.log(1 + chunks.length / (documentFrequency.get(term) ?? 1))
    ), 0);
    return { chunk, score };
  }).sort((left, right) => right.score - left.score);

  const selected = [];
  const selectedPages = new Set();
  for (const item of scored) {
    const pageKey = `${item.chunk.documentName}\u0000${item.chunk.pageNumber}`;
    if (selectedPages.has(pageKey)) continue;
    selected.push(item.chunk);
    selectedPages.add(pageKey);
    if (selected.length === limit) return selected;
  }
  for (const item of scored) {
    if (selected.includes(item.chunk)) continue;
    selected.push(item.chunk);
    if (selected.length === limit) break;
  }
  return selected;
}

export function parseDoctorDiscussion(text, sources, speakerOrder = Array.from({ length: 3 }, () => discussionDoctors.map(({ id }) => id)).flat()) {
  const cleanText = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  let result;
  try {
    result = JSON.parse(cleanText);
  } catch {
    throw new Error('Ollama returned an unreadable discussion. Please try again.');
  }
  if (!Array.isArray(result?.discussion) || result.discussion.length !== speakerOrder.length) {
    throw new Error('Ollama returned an incomplete three-doctor discussion. Please try again.');
  }

  const sourceIds = new Set(sources.map((source) => source.id));
  const discussion = result.discussion.map((turn, index) => {
    const doctor = discussionDoctors.find(({ id }) => id === speakerOrder[index]);
    const citations = turn?.citation_ids;
    const message = typeof turn?.text === 'string' ? turn.text.trim() : '';
    if (!doctor || turn?.speaker !== doctor.id || !message || message.length > 700
      || !Array.isArray(citations) || citations.length < 1 || citations.length > 3
      || citations.some((id) => typeof id !== 'string' || !sourceIds.has(id))) {
      throw new Error('Ollama returned an invalid speaker, message, or unsupported citation. No discussion was saved.');
    }
    return {
      speaker: doctor.name,
      role: doctor.role,
      text: message,
      citations: citations.map((id) => sources.find((source) => source.id === id)),
    };
  });
  return { discussion, sources };
}
