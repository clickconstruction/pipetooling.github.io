/** Absolute URL to the public Terms and Conditions page (SPA). */
export function estimateTermsPageHref(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/estimate/terms`
  }
  return '/estimate/terms'
}
