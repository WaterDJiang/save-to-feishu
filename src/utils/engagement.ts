import type { ProductEngagement } from '@/types';

export const RATING_FIRST_MILESTONE = 5;
export const RATING_REPROMPT_INTERVAL = 15;
export const CHROME_WEB_STORE_REVIEW_URL = 'https://chromewebstore.google.com/detail/gbnmbddjficnnielhclmokflbmlofnko/reviews';

export const DEFAULT_PRODUCT_ENGAGEMENT: ProductEngagement = {
  successfulSaveCount: 0,
  ratingCompleted: false,
  lastRatingPromptSaveCount: 0,
};

export function normalizeProductEngagement(value: unknown): ProductEngagement {
  if (!value || typeof value !== 'object') return { ...DEFAULT_PRODUCT_ENGAGEMENT };
  const candidate = value as Partial<ProductEngagement>;
  return {
    successfulSaveCount: Number.isFinite(candidate.successfulSaveCount)
      ? Math.max(0, Math.floor(candidate.successfulSaveCount || 0))
      : 0,
    ratingCompleted: Boolean(candidate.ratingCompleted),
    lastRatingPromptSaveCount: Number.isFinite(candidate.lastRatingPromptSaveCount)
      ? Math.max(0, Math.floor(candidate.lastRatingPromptSaveCount || 0))
      : 0,
  };
}

export function recordSuccessfulSave(engagement: ProductEngagement): ProductEngagement {
  const normalized = normalizeProductEngagement(engagement);
  return {
    ...normalized,
    successfulSaveCount: normalized.successfulSaveCount + 1,
  };
}

export function shouldShowRatingPrompt(engagement: ProductEngagement): boolean {
  const normalized = normalizeProductEngagement(engagement);
  if (normalized.ratingCompleted || normalized.successfulSaveCount < RATING_FIRST_MILESTONE) {
    return false;
  }
  if (normalized.lastRatingPromptSaveCount === 0) return true;
  return normalized.successfulSaveCount - normalized.lastRatingPromptSaveCount >= RATING_REPROMPT_INTERVAL;
}

export function dismissRatingPrompt(engagement: ProductEngagement): ProductEngagement {
  const normalized = normalizeProductEngagement(engagement);
  return {
    ...normalized,
    lastRatingPromptSaveCount: normalized.successfulSaveCount,
  };
}

export function completeRatingPrompt(engagement: ProductEngagement): ProductEngagement {
  const normalized = normalizeProductEngagement(engagement);
  return {
    ...normalized,
    ratingCompleted: true,
    lastRatingPromptSaveCount: normalized.successfulSaveCount,
  };
}
