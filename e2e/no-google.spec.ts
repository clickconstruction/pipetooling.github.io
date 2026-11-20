import { test, expect } from './fixtures'

/**
 * The suite asks Google for nothing (v2.8049). In a real browser, on a blank page, the fixture in
 * `./fixtures.ts` holds a Google map script and a call to an edge function that asks Google. No live
 * page is opened and nothing leaves the machine, so this runs in a second on every smoke run and says
 * at once if the holding ever stops working.
 */
test('a Google map script and a call that asks Google never leave the browser', async ({ page }) => {
  await page.setContent('<!doctype html><title>No Google</title>')
  const outcomes = await page.evaluate(async () => {
    const ask = (href: string) => fetch(href, { mode: 'no-cors' }).then(
      () => 'answered',
      () => 'held',
    )
    return [await ask('https://maps.googleapis.com/maps/api/js?key=AIza-made-up&v=weekly'), await ask('https://example.supabase.co/functions/v1/geocode-address-batch')]
  })
  expect(outcomes).toEqual(['held', 'held'])
})
