import assert from 'node:assert/strict';
import test from 'node:test';

import { generateMarkdownFilename } from '../src/utils/markdownFilename.ts';

test('generateMarkdownFilename prefixes the existing title rule with the download date', () => {
  assert.equal(
    generateMarkdownFilename('测试 / 页面: 标题', new Date(2026, 3, 22)),
    '20260422_测试-页面-标题.md'
  );
});

test('generateMarkdownFilename keeps the fallback name for an empty sanitized title', () => {
  assert.equal(
    generateMarkdownFilename('///', new Date(2026, 3, 22)),
    '20260422_page-content.md'
  );
});
