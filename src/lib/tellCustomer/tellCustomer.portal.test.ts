import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { DEFAULT_LINES, PORTAL_CLOSE, tellFills, tellWords, withPortalClose } from './tellCustomer'

/** Customer reviews (v2.5943, punch list #185): the one link that is theirs. */
const DANA = tellFills({ customerName: 'Dana Whitfield', me: 'Rosa Perez', jobName: 'the water heater', jobAddress: '1208 Mesquite Ln', portalUrl: 'my.clickplumbing.com/dana-whitfield-k7', billLink: 'https://clicktooling.com/pay/4b19e' })

describe('the portal close on the app’s own lines', () => {
  it('fills {portal} from the customer’s short address, and nothing without one', () => {
    expect(DANA.portal).toBe('my.clickplumbing.com/dana-whitfield-k7')
    expect(tellFills({ customerName: 'Dana', me: 'Rosa', jobName: null, jobAddress: null }).portal).toBeUndefined()
  })

  it('closes a line with no link of its own, and leaves a line with one alone', () => {
    expect(withPortalClose('We have you booked for Friday.', DANA, 'en')).toBe('We have you booked for Friday. Everything about this job is at {portal}.')
    expect(withPortalClose('Tenemos su visita el viernes.', DANA, 'es')).toBe('Tenemos su visita el viernes. Todo sobre este trabajo está en {portal}.')
    expect(withPortalClose('Open it to approve: {link}', DANA, 'en')).toBe('Open it to approve: {link}')
    expect(withPortalClose('You can pay it here: {bill}', DANA, 'en')).toBe('You can pay it here: {bill}')
    expect(withPortalClose('Two taps: https://clicktooling.com/r/c91d', DANA, 'en')).toBe('Two taps: https://clicktooling.com/r/c91d')
    expect(withPortalClose('We have you booked for Friday.', {}, 'en')).toBe('We have you booked for Friday.')
  })

  it('the sheet closes the app’s own words and never the office’s line', () => {
    const own = tellWords({ ...DEFAULT_LINES.done, office: false }, DANA, 'en')
    expect(own.text).toBe('Dana, this is Rosa with Click Plumbing. The work on the water heater is done. Your bill follows by email. Text me here with any question. Everything about this job is at my.clickplumbing.com/dana-whitfield-k7.')
    expect(own.left).toEqual([])
    const office = tellWords({ text: '{first}, we are done at {address}.', textEs: null, office: true }, DANA, 'en')
    expect(office.text).toBe('Dana, we are done at 1208 Mesquite Ln.')
    const estimate = tellWords({ ...DEFAULT_LINES.estimate, office: false }, DANA, 'en')
    expect(estimate.text).not.toContain('Everything about this job')
    expect(estimate.left).toEqual(['amount', 'link'])
    expect(plainWordsFailures(PORTAL_CLOSE.text)).toEqual([])
  })
})
