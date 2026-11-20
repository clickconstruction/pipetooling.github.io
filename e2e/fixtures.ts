import { test as base, expect, type Request } from '@playwright/test'
import { googleBoundLabel, heldSummary, isGoogleBound } from '../src/test/smokeNoGoogle'

/**
 * Every smoke spec, the sign-in included, takes `test` and `expect` from here (held by
 * `src/test/smokeNoGoogle.test.ts`).
 *
 * The suite signs in to the live site, so whatever it opens is real use to Google: a Google map
 * load, a geocode, a Street View picture (v2.8049, docs/E2E_SMOKE.md). This fixture runs for every
 * test on its own. It stops each request bound for Google or for an edge function that asks Google
 * (`src/test/smokeNoGoogle.ts`) before it leaves the browser, so the maps fall back to OpenStreetMap
 * the way they do for a person whose Google fails. It notes what it held on the test's report, by
 * host or function name and never by query.
 *
 * The test fails if such a request got any answer anyway, or is still on its way when the test ends.
 * Each one is noted as it starts and waited on at the end: the finished event of an answered request
 * lands a moment after the test's last line, too late to be read then.
 *
 * The app's service worker serves only its own page loads, so every request to Google passes the
 * context's routes. Should the worker ever fetch Google itself, set `serviceWorkers: 'block'`.
 */
const SETTLE_MS = 5_000

/** The request's answer, or null when it never got one (held, refused, cut); `pending` when it is still out. */
async function settled(request: Request): Promise<'answered' | 'pending' | null> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const late = new Promise<'pending'>((resolve) => {
    timer = setTimeout(() => resolve('pending'), SETTLE_MS)
  })
  try {
    const outcome = await Promise.race([request.response().then((r) => (r ? 'answered' : null), () => null), late])
    return outcome
  } finally {
    clearTimeout(timer)
  }
}

export const test = base.extend<{ noGoogle: void }>({
  noGoogle: [
    async ({ context }, use, testInfo) => {
      const held: string[] = []
      const bound: Request[] = []
      await context.route(
        (url) => isGoogleBound(url),
        async (route) => {
          held.push(googleBoundLabel(new URL(route.request().url())))
          await route.abort('blockedbyclient')
        },
      )
      const onRequest = (request: Request) => {
        if (isGoogleBound(new URL(request.url()))) bound.push(request)
      }
      context.on('request', onRequest)
      await use()
      context.off('request', onRequest)
      const outcomes = await Promise.all(bound.map(settled))
      const reached = bound
        .map((request, i) => ({ label: googleBoundLabel(new URL(request.url())), outcome: outcomes[i] }))
        .filter((r) => r.outcome != null)
        .map((r) => `${r.label} (${r.outcome})`)
      if (held.length > 0) testInfo.annotations.push({ type: 'Held back from Google', description: heldSummary(held) })
      expect(reached, 'requests that reached Google or an edge function that asks Google').toEqual([])
    },
    { auto: true },
  ],
})

export { expect }
