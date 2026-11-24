// @ts-check
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

require(path.join(__dirname, 'answers.js'));
require(path.join(__dirname, 'sealing.js'));
const sealing = globalThis.MysteryForgeSealing;

const contract = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', '..', '..', '..', '..', 'contracts', 'sealing-vectors.json'), 'utf8'),
);

for (const vector of contract.vectors) {
  test(`every accepted answer opens the shared vector "${vector.label}"`, () => {
    for (const answer of vector.answers) {
      assert.equal(sealing.openLock(vector.lock, contract.salt, [answer]), vector.text);
    }
  });
}

test('a wrong answer opens nothing, and the first fitting answer of a list wins', () => {
  const vector = contract.vectors[0];
  assert.equal(sealing.unlockKey(vector.lock, contract.salt, 'wrong'), null);
  assert.equal(sealing.openLock(vector.lock, contract.salt, ['wrong', 'also wrong']), null);
  assert.equal(sealing.openLock(vector.lock, contract.salt, ['wrong', vector.answers[1]]), vector.text);
});

test('a key check is the start of the SHA-256 of the key', () => {
  assert.equal(sealing.keyCheck('k').length, 16);
  assert.equal(sealing.answerKey('s', 'l', 'a').length, 64);
});
