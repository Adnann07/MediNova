import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { normalizeOpeniSearchResponse } from './openi.mjs';

test('normalizes the observed Open-i image, caption, and article response fields', () => {
  const [item] = normalizeOpeniSearchResponse({
    count: 1,
    list: [{
      uid: 'PMC9196219',
      title: 'A fictionalized radiology teaching example',
      articleType: 'cr',
      pmcid: '9196219',
      pmid: '35734480',
      pmc_url: 'http://www.ncbi.nlm.nih.gov/pmc/articles/PMC9196219',
      imgLarge: '/imgs/512/86/9196219/example.png',
      image: {
        caption: 'Example <b>chest X-ray</b> caption.',
        mention: 'Published figure context.',
      },
    }],
  });

  assert.equal(item.imageUrl, 'https://openi.nlm.nih.gov/imgs/512/86/9196219/example.png');
  assert.equal(item.reference.caption, 'Example chest X-ray caption.');
  assert.equal(item.reference.clinicalInformation, 'Published figure context.');
  assert.equal(item.reference.articleUrl, 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9196219');
  assert.equal(item.reference.pmid, '35734480');
});

test('rejects images outside Open-i and omits unverified diagnosis fields', () => {
  const cases = normalizeOpeniSearchResponse({
    list: [
      { uid: 'unsafe-image', imgLarge: 'https://example.org/image.png', image: { caption: 'External' } },
      { uid: 'unsafe-ncbi-image', imgLarge: 'https://cdn.ncbi.nlm.nih.gov/other/image.png', image: { caption: 'External' } },
      { uid: 'openi-image', imgLarge: '/imgs/512/1/2/image.png', image: { caption: 'Caption only.' } },
      { uid: 'pmc-image', imgLarge: 'https://cdn.ncbi.nlm.nih.gov/pmc/blobs/abcd/1234/image.jpg', image: { caption: 'Published figure.' } },
    ],
  });
  assert.equal(cases.length, 2);
  assert.equal(Object.hasOwn(cases[0].reference, 'diagnosis'), false);
  assert.equal(cases[0].reference.clinicalInformation, '');
  assert.equal(cases[0].reference.articleUrl, null);
  assert.equal(cases[1].imageProvider, 'PubMed Central');
});

test('reports incompatible Open-i response shapes instead of treating them as empty', () => {
  assert.throws(() => normalizeOpeniSearchResponse({ results: [] }), /unexpected search response/);
});

test('keeps verified cached Open-i records available for the chest X-ray fallback', () => {
  const fallbackPath = fileURLToPath(new URL('./openi-cached-examples.json', import.meta.url));
  const records = normalizeOpeniSearchResponse(JSON.parse(readFileSync(fallbackPath, 'utf8')));
  assert.equal(records.length, 2);
  assert.match(records[0].imageUrl, /^https:\/\/cdn\.ncbi\.nlm\.nih\.gov\/pmc\/blobs\//);
  assert.equal(records[0].imageProvider, 'PubMed Central');
  assert.match(records[0].reference.caption, /chest X-ray/);
  assert.equal(records[0].reference.articleUrl, 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7472981');
});