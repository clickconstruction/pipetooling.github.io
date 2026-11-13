import { describe, expect, it } from 'vitest'
import { payLinkUrl } from '../billing/payLink'
import { payQrSvgMarkup } from '../billing/payQr'
import { PAY_PAGE_QR_PX } from '../jobs/lienNoticePayPageAssets'
import { SAMPLE_PAY_CODE_ID, SAMPLE_PAY_CODE_SVG } from './samplePayCode'

describe('the sample demand letter’s pay code (v2.7086)', () => {
  it('is the drawing the app makes for the sample bill’s address, so it cannot drift from a real code', async () => {
    expect(SAMPLE_PAY_CODE_SVG).toBe(await payQrSvgMarkup(payLinkUrl(SAMPLE_PAY_CODE_ID), PAY_PAGE_QR_PX, null))
    expect(payLinkUrl(SAMPLE_PAY_CODE_ID).endsWith('/pay/sample')).toBe(true)
  })
})
