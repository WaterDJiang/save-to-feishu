import assert from 'node:assert/strict';
import test from 'node:test';

import { buildFeedbackIssueUrl, getChromeVersion } from '../src/utils/feedback.ts';

test('getChromeVersion extracts Chrome version without other user agent data', () => {
  assert.equal(
    getChromeVersion('Mozilla/5.0 Chrome/137.0.7151.69 Safari/537.36'),
    '137.0.7151.69'
  );
});

test('buildFeedbackIssueUrl includes only non-sensitive environment details', () => {
  const url = buildFeedbackIssueUrl({
    extensionVersion: '0.5.8',
    userAgent: 'Mozilla/5.0 Chrome/137.0.7151.69 Safari/537.36',
  });
  const parsed = new URL(url);
  const body = parsed.searchParams.get('body') || '';

  assert.equal(parsed.origin + parsed.pathname, 'https://github.com/WaterDJiang/save-to-feishu/issues/new');
  assert.match(body, /插件版本：0\.5\.8/);
  assert.match(body, /Chrome 版本：137\.0\.7151\.69/);
  assert.doesNotMatch(body, /Mozilla|Safari|https:\/\/example\.com/);
});
