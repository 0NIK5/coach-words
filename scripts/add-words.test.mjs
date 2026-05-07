import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mapOxfordType, formatId, shuffleArray } from './add-words.mjs';

describe('mapOxfordType', () => {
  it('maps direct types', () => {
    assert.equal(mapOxfordType('noun'), 'noun');
    assert.equal(mapOxfordType('verb'), 'verb');
    assert.equal(mapOxfordType('adjective'), 'adjective');
    assert.equal(mapOxfordType('adverb'), 'adverb');
    assert.equal(mapOxfordType('conjunction'), 'conjunction');
    assert.equal(mapOxfordType('preposition'), 'preposition');
    assert.equal(mapOxfordType('determiner'), 'determiner');
    assert.equal(mapOxfordType('pronoun'), 'pronoun');
  });

  it('maps verb subtypes to verb', () => {
    assert.equal(mapOxfordType('auxiliary verb'), 'verb');
    assert.equal(mapOxfordType('modal verb'), 'verb');
    assert.equal(mapOxfordType('linking verb'), 'verb');
  });

  it('returns null for unsupported types', () => {
    assert.equal(mapOxfordType('indefinite article'), null);
    assert.equal(mapOxfordType('definite article'), null);
    assert.equal(mapOxfordType('number'), null);
    assert.equal(mapOxfordType('ordinal number'), null);
    assert.equal(mapOxfordType('exclamation'), null);
    assert.equal(mapOxfordType('infinitive marker'), null);
    assert.equal(mapOxfordType('unknown'), null);
  });
});

describe('formatId', () => {
  it('pads number to 3 digits', () => {
    assert.equal(formatId('B2', 1), 'b2_001');
    assert.equal(formatId('A2', 99), 'a2_099');
    assert.equal(formatId('C1', 700), 'c1_700');
  });
});

describe('shuffleArray', () => {
  it('returns array of same length', () => {
    const arr = [1, 2, 3, 4, 5];
    assert.equal(shuffleArray(arr).length, arr.length);
  });

  it('does not mutate the original array', () => {
    const arr = [1, 2, 3];
    shuffleArray(arr);
    assert.deepEqual(arr, [1, 2, 3]);
  });

  it('contains same elements', () => {
    const arr = [1, 2, 3, 4, 5];
    const result = shuffleArray(arr);
    assert.deepEqual([...result].sort((a, b) => a - b), [1, 2, 3, 4, 5]);
  });
});
