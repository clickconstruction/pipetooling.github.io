/**
 * A customer's sample page (punch list #202): one of What customers see's previews, opened on a
 * sample token — `?t=sample`, `?t=sample-done`, `/pay/sample`, `/q/sample-done`, `/t/sample`. Its
 * edge function answers such a token with the fixture laid over today's Settings, never a real row
 * (`supabase/functions/_shared/customerSample.ts`), so a sealed frame drawing one may let that call
 * out. Pure, and kept apart from the fixture so the seal stays one small module.
 */

/** `sample`, or `sample-` and a suffix: `sample-done`, `sample-gc`, `sample-owner`, `sample-low`. */
const SAMPLE_TOKEN = /^sample(-[a-z0-9]+)*$/

export function isSampleToken(token: string | null | undefined): boolean {
  return typeof token === 'string' && SAMPLE_TOKEN.test(token.trim())
}

/** True when the page's own address names a sample token, in `t` or as a path segment. */
export function isSamplePage(href: string): boolean {
  let url: URL
  try {
    url = new URL(href)
  } catch {
    return false
  }
  if (isSampleToken(url.searchParams.get('t'))) return true
  return url.pathname.split('/').some((segment) => isSampleToken(segment))
}
