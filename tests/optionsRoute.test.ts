import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildOptionsHash,
  buildTableMappingOptionsHash,
  parseOptionsHash,
} from '../src/utils/optionsRoute.ts';

test('buildTableMappingOptionsHash points to the selected table field mapping route', () => {
  assert.equal(
    buildTableMappingOptionsHash('table a/b'),
    '#tables/table%20a%2Fb/fields'
  );
});

test('parseOptionsHash reads table mapping routes', () => {
  assert.deepEqual(parseOptionsHash('#tables/table%20a%2Fb/fields'), {
    view: 'tables',
    tableId: 'table a/b',
    autoLoadFields: true,
  });
});

test('buildOptionsHash preserves selected table routes without auto loading fields', () => {
  assert.equal(
    buildOptionsHash({ view: 'tables', tableId: 'table a/b', autoLoadFields: false }),
    '#tables/table%20a%2Fb'
  );
});

