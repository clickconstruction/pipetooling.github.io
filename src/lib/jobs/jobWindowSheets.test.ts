import { describe, expect, it } from 'vitest'
import { JOB_WINDOW_BODY_SCROLL, jobWindowBarStandsDown } from './jobWindowSheets'

describe('jobWindowBarStandsDown', () => {
  it('keeps the bar while no sheet is up', () => {
    expect(jobWindowBarStandsDown({})).toBe(false)
    expect(jobWindowBarStandsDown({ status: false, more: false, note: false })).toBe(false)
  })

  it('stands the bar down for each of the window’s sheets, alone or together', () => {
    expect(jobWindowBarStandsDown({ note: true })).toBe(true)
    expect(jobWindowBarStandsDown({ status: true })).toBe(true)
    expect(jobWindowBarStandsDown({ more: true })).toBe(true)
    expect(jobWindowBarStandsDown({ status: true, more: true, note: true })).toBe(true)
  })

  it('reads a sheet the pane has not reported yet as shut', () => {
    expect(jobWindowBarStandsDown({ status: false, note: undefined })).toBe(false)
  })
})

describe('JOB_WINDOW_BODY_SCROLL', () => {
  it('scrolls the body and holds the scroll in, with no touch-scrolling layer to cut a sheet pinned from inside', () => {
    expect(JOB_WINDOW_BODY_SCROLL).toEqual({ overflowY: 'auto', overscrollBehavior: 'contain' })
    expect(Object.keys(JOB_WINDOW_BODY_SCROLL)).not.toContain('WebkitOverflowScrolling')
  })
})
