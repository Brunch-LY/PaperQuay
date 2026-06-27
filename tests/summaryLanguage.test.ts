import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

import { resolveSummaryOutputLanguage } from '../src/services/summaryLanguage.ts';

const require = createRequire(import.meta.url);
const { buildPaperSummaryPrompt } = require('../electron/backend/aiCommands.cjs') as {
  buildPaperSummaryPrompt: (options: { outputLanguage?: string }) => string;
};

test('resolveSummaryOutputLanguage follows the UI language by default', () => {
  assert.equal(
    resolveSummaryOutputLanguage({
      summaryOutputLanguage: 'follow-ui',
      uiLanguage: 'zh-CN',
    }),
    'Chinese',
  );

  assert.equal(
    resolveSummaryOutputLanguage({
      summaryOutputLanguage: '',
      uiLanguage: 'en-US',
    }),
    'English',
  );
});

test('resolveSummaryOutputLanguage preserves an explicit custom language', () => {
  assert.equal(
    resolveSummaryOutputLanguage({
      summaryOutputLanguage: 'Japanese',
      uiLanguage: 'zh-CN',
    }),
    'Japanese',
  );
});

test('buildPaperSummaryPrompt requires target-language JSON values', () => {
  const prompt = buildPaperSummaryPrompt({ outputLanguage: 'Chinese' });

  assert.match(prompt, /Chinese/);
  assert.match(prompt, /every user-visible string value/);
  assert.match(prompt, /every item in keyFindings, takeaways, and keywords/);
  assert.match(prompt, /Translate or paraphrase source text/);
});
