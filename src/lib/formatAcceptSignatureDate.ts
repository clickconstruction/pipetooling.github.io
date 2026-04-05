/**
 * Long US-style date for the estimate acceptance signature preview (browser-local calendar).
 */
export function formatAcceptSignatureDate(d: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(d)
}
