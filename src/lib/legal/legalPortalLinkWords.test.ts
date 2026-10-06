/** Punch list #85, item 22: rotating or turning off the firm's link says that every emailed link dies too. */
import { describe, expect, it } from 'vitest'
import { rotateLinkMessage, turnOffLinkMessage } from './legalPortalLinkWords'

describe('the Firm’s link confirms', () => {
  it('say that the link in every email already sent stops opening', () => {
    for (const words of [rotateLinkMessage('Sample & Partner, PLLC'), turnOffLinkMessage('Sample & Partner, PLLC')]) {
      expect(words).toContain('Sample & Partner, PLLC')
      expect(words).toMatch(/every email already sent to the firm/)
    }
  })

  it('tell the office to send the new link after rotating', () => {
    expect(rotateLinkMessage('the firm')).toMatch(/Send the new link to the firm/)
  })

  it('reads as one sentence: the old link stops working the moment a new one is minted', () => {
    expect(rotateLinkMessage('Sample & Partner, PLLC')).toMatch(/^The link Sample & Partner, PLLC has now stops working the moment you mint a new one\./)
    expect(rotateLinkMessage('x')).not.toMatch(/has now stops opening at once/)
  })
})
