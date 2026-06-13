import assert from 'node:assert/strict';
import test from 'node:test';

import {
  completeRatingPrompt,
  dismissRatingPrompt,
  normalizeProductEngagement,
  recordSuccessfulSave,
  shouldShowRatingPrompt,
} from '../src/utils/engagement.ts';

test('rating prompt becomes eligible after five successful saves', () => {
  let engagement = normalizeProductEngagement(undefined);
  for (let index = 0; index < 4; index += 1) {
    engagement = recordSuccessfulSave(engagement);
  }
  assert.equal(shouldShowRatingPrompt(engagement), false);

  engagement = recordSuccessfulSave(engagement);
  assert.equal(engagement.successfulSaveCount, 5);
  assert.equal(shouldShowRatingPrompt(engagement), true);
});

test('dismissing rating prompt waits for fifteen more successful saves', () => {
  let engagement = {
    successfulSaveCount: 5,
    ratingCompleted: false,
    lastRatingPromptSaveCount: 0,
  };
  engagement = dismissRatingPrompt(engagement);
  for (let index = 0; index < 14; index += 1) {
    engagement = recordSuccessfulSave(engagement);
  }
  assert.equal(shouldShowRatingPrompt(engagement), false);

  engagement = recordSuccessfulSave(engagement);
  assert.equal(engagement.successfulSaveCount, 20);
  assert.equal(shouldShowRatingPrompt(engagement), true);
});

test('completed rating prompt never appears again', () => {
  const engagement = completeRatingPrompt({
    successfulSaveCount: 20,
    ratingCompleted: false,
    lastRatingPromptSaveCount: 5,
  });
  assert.equal(shouldShowRatingPrompt(recordSuccessfulSave(engagement)), false);
});
