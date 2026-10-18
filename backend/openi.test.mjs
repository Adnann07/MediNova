import test from 'node:test';
import assert from 'node:assert/strict';
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
      { uid: 'openi-image', imgLarge: '/imgs/512/1/2/image.png', image: { caption: 'Caption only.' } },
    ],
  });
  assert.equal(cases.length, 1);
  assert.equal(Object.hasOwn(cases[0].reference, 'diagnosis'), false);
  assert.equal(cases[0].reference.clinicalInformation, '');
  assert.equal(cases[0].reference.articleUrl, null);
});

test('reports incompatible Open-i response shapes instead of treating them as empty', () => {
  assert.throws(() => normalizeOpeniSearchResponse({ results: [] }), /unexpected search response/);
});