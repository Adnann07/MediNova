const openiOrigin = 'https://openi.nlm.nih.gov';

function cleanText(value, maximum = 5000) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maximum);
}

function openiImageUrl(path) {
  if (typeof path !== 'string' || !path.trim()) return null;
  try {
    const url = new URL(path, openiOrigin);
    const isOpeniImage = url.hostname === 'openi.nlm.nih.gov' && url.pathname.startsWith('/imgs/');
    const isPmcImage = url.hostname === 'cdn.ncbi.nlm.nih.gov'
      && url.pathname.startsWith('/pmc/blobs/')
      && /\.(?:jpe?g|png|gif)$/i.test(url.pathname);
    if (url.protocol !== 'https:' || (!isOpeniImage && !isPmcImage)) return null;
    return url.href;
  } catch {
    return null;
  }
}

function articleUrl(item) {
  for (const candidate of [item.pmc_url, item.pubMed_url]) {
    if (typeof candidate !== 'string') continue;
    try {
      const url = new URL(candidate);
      if (url.hostname === 'www.ncbi.nlm.nih.gov' || url.hostname === 'ncbi.nlm.nih.gov' || url.hostname === 'pubmed.ncbi.nlm.nih.gov') {
        url.protocol = 'https:';
        return url.href;
      }
    } catch {
      continue;
    }
  }
  return null;
}

export function normalizeOpeniSearchResponse(payload) {
  if (!payload || !Array.isArray(payload.list)) {
    throw new Error('Open-i returned an unexpected search response; no image cases were loaded.');
  }
  const cases = [];
  for (const item of payload.list) {
    const imageUrl = openiImageUrl(item?.imgLarge);
    const uid = typeof item?.uid === 'string' ? item.uid.trim() : '';
    if (!imageUrl || !uid) continue;
    const reference = {
      title: cleanText(item.title, 500),
      caption: cleanText(item.image?.caption, 1600),
      clinicalInformation: cleanText(item.image?.mention || item.abstract, 4500),
      articleUrl: articleUrl(item),
      articleType: cleanText(item.articleType, 80),
      pmid: cleanText(item.pmid, 40),
      pmcid: cleanText(item.pmcid, 40),
    };
    if (!reference.caption && !reference.clinicalInformation) continue;
    cases.push({
      referenceId: `${uid}:${new URL(imageUrl).pathname.split('/').pop()}`,
      imageUrl,
      imageProvider: new URL(imageUrl).hostname === 'cdn.ncbi.nlm.nih.gov' ? 'PubMed Central' : 'Open-i',
      reference,
    });
  }
  return cases;
}