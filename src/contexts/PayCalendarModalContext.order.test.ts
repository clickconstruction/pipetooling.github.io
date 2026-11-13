/**
 * The Pay calendar window's provider sits above every provider that draws a window with a Pay
 * calendar press inside it (punch list #341). Until then it sat below the job window's and Bill
 * Customer's, so the Their paper sheet opened from either found no opener and drew no press.
 * Read from the source: mounting the app's whole tree to prove an order costs more than it tells.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const app = readFileSync(fileURLToPath(new URL('../App.tsx', import.meta.url)), 'utf8')
const opens = (name: string): number => app.indexOf(`<${name}>`)

describe('PayCalendarModalProvider in the app tree', () => {
  it.each(['BillCustomerModalProvider', 'JobFormModalProvider', 'JobDetailModalProvider', 'CustomerProfileModalProvider'])('wraps %s', (inner) => {
    expect(opens('PayCalendarModalProvider')).toBeGreaterThan(-1)
    expect(opens(inner)).toBeGreaterThan(-1)
    expect(opens('PayCalendarModalProvider')).toBeLessThan(opens(inner))
  })
})
