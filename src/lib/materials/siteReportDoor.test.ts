import { describe, expect, it } from 'vitest'
import { asksForMaterialsReport, withoutReport } from './siteReportDoor'

describe('the door to a site’s material location report (finding 325)', () => {
  it('the address asks for the paper with report=materials, and with nothing else', () => {
    expect(asksForMaterialsReport(new URLSearchParams('report=materials'))).toBe(true)
    expect(asksForMaterialsReport(new URLSearchParams('look=trips&report=materials'))).toBe(true)
    expect(asksForMaterialsReport(new URLSearchParams('report=money'))).toBe(false)
    expect(asksForMaterialsReport(new URLSearchParams('look=trips'))).toBe(false)
    expect(asksForMaterialsReport(new URLSearchParams(''))).toBe(false)
  })

  it('on close the mark comes out and every other mark stays', () => {
    expect(withoutReport(new URLSearchParams('report=materials'))?.toString()).toBe('')
    expect(withoutReport(new URLSearchParams('all=1&report=materials&look=trips'))?.toString()).toBe('all=1&look=trips')
  })

  it('an address with no mark is left alone: the window was opened by its own press', () => {
    expect(withoutReport(new URLSearchParams('look=trips'))).toBeNull()
    expect(withoutReport(new URLSearchParams(''))).toBeNull()
  })

  it('never changes the address it was handed', () => {
    const search = new URLSearchParams('report=materials&all=1')
    withoutReport(search)
    expect(search.toString()).toBe('report=materials&all=1')
  })
})
