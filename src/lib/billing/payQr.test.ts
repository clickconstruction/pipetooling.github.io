import { describe, expect, it } from 'vitest'
import { brandMarkPath, PAY_QR_LEVEL, payQrImageSettings, payQrProps, payQrSheetHtml, payQrSvgMarkup } from './payQr'
import { payLinkUrl } from './payLink'

const ID = '8f3c2a1e-6b7d-4c9a-9e21-5d0f7a3b1c44'
const MARK = 'data:image/png;base64,iVBORw0KGgo='

describe('payQr — the props every code shares', () => {
  it('draws at level Q, black on white, two quiet modules, with the mark carved out at 22%', () => {
    const p = payQrProps(payLinkUrl(ID), 240, MARK)
    expect(p.level).toBe('Q')
    expect(PAY_QR_LEVEL).toBe('Q')
    expect(p.fgColor).toBe('#111111')
    expect(p.bgColor).toBe('#ffffff')
    expect(p.marginSize).toBe(2)
    expect(p.imageSettings).toEqual({ src: MARK, height: 53, width: 53, excavate: true })
    expect(payQrProps(payLinkUrl(ID), 240, null).imageSettings).toBeUndefined()
  })

  it('never shrinks the mark below a readable size', () => {
    expect(payQrImageSettings(20, MARK).width).toBe(8)
  })

  it('knows where the mark lives under any base path', () => {
    expect(brandMarkPath('/')).toBe('/brand/click-mark.png')
    expect(brandMarkPath('/app/')).toBe('/app/brand/click-mark.png')
  })
})

describe('payQr — the print markup', () => {
  it('renders the pay address as a 41-module code with the mark inlined', async () => {
    const svg = await payQrSvgMarkup(payLinkUrl(ID), 120, MARK)
    expect(svg.startsWith('<svg')).toBe(true)
    // 41 modules at level Q for the pay address, plus two quiet modules a side.
    expect(svg).toContain('viewBox="0 0 45 45"')
    expect(svg).toContain('<image')
    expect(svg).toContain(MARK)
  })

  it('draws a plain code when the mark could not be loaded', async () => {
    const svg = await payQrSvgMarkup(payLinkUrl(ID), 120, null)
    expect(svg).not.toContain('<image')
    expect(svg).toContain('viewBox="0 0 45 45"')
  })
})

describe('payQr — the half-sheet', () => {
  it('is light paper naming the bill, the amount and the address in words, with the code inside', () => {
    const html = payQrSheetHtml({ company: 'Click Plumbing and Electrical', billLabel: 'Invoice #1025-2609180905', jobName: 'Lago Vista <St>', amountLabel: '$4,660.00', invoiceId: ID, svg: '<svg data-code></svg>' })
    expect(html).toContain('data-theme="light"')
    expect(html).toContain('Scan to pay')
    expect(html).toContain('Invoice #1025-2609180905 · Lago Vista &lt;St&gt;')
    expect(html).toContain('$4,660.00')
    expect(html).toContain('<svg data-code></svg>')
    expect(html).toContain(`clicktooling.com/pay/${ID}`)
  })

  it('hides the amount line when the balance is not known', () => {
    const html = payQrSheetHtml({ company: 'C', billLabel: 'Bill', jobName: '', amountLabel: '', invoiceId: ID, svg: '' })
    expect(html).not.toContain('class="amt"')
    expect(html).toContain('<div class="what">Bill</div>')
  })
})
