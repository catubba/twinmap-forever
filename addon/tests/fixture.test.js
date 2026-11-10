const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const { record, FILE } = require('./record');

test('the strips recorded for the app are the ones the addon draws today', () => {
  assert.deepEqual(JSON.parse(fs.readFileSync(FILE, 'utf8')), record(), 'the addon changed: run "npm run record" in addon/, then the app tests');
});
