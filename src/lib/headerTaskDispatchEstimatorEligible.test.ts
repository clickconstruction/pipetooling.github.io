import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  HEADER_ASK_ESTIMATING_LABEL,
  showEstimatorInboxButton,
  isBidsPagePath,
  showHeaderNewBidButton,
  showTaskDispatchButton,
} from './headerTaskDispatchEstimatorEligible'

const LAYOUT_PATH = join(__dirname, '../components/Layout.tsx')

describe('HEADER_ASK_ESTIMATING_LABEL', () => {
  it('is field language, not the office inbox name', () => {
    expect(HEADER_ASK_ESTIMATING_LABEL).toBe('Ask estimating')
  })

  it('is the title and aria-label on BOTH header pairs (desktop text button + mobile icon button)', () => {
    const layout = readFileSync(LAYOUT_PATH, 'utf8')
    const titles = layout.match(/title=\{HEADER_ASK_ESTIMATING_LABEL\}/g) ?? []
    const arias = layout.match(/aria-label=\{HEADER_ASK_ESTIMATING_LABEL\}/g) ?? []
    expect(titles).toHaveLength(2)
    expect(arias).toHaveLength(2)
  })

  it('leaves no "Estimator Inbox" literal on the header button (J2-F7 / J30-N3)', () => {
    const layout = readFileSync(LAYOUT_PATH, 'utf8')
    expect(layout).not.toMatch(/Estimator Inbox/)
  })
})

describe('showEstimatorInboxButton', () => {
  it('shows for the same roles as Task Dispatch (field roles included — they send, they do not receive)', () => {
    for (const role of ['dev', 'master_technician', 'assistant', 'estimator', 'subcontractor', 'helpers'] as const) {
      expect(showEstimatorInboxButton(role)).toBe(showTaskDispatchButton(role))
      expect(showEstimatorInboxButton(role)).toBe(true)
    }
    expect(showEstimatorInboxButton(null)).toBe(false)
  })
})

describe('showHeaderNewBidButton (v2.6167, the Bids page alone since v2.6839)', () => {
  it('every role that can make a bid has the press on the Bids page, off in Task Mode', () => {
    for (const role of ['dev', 'master_technician', 'assistant', 'controller', 'estimator', 'superintendent'] as const) {
      expect(showHeaderNewBidButton(role, false, '/bids')).toBe(true)
      expect(showHeaderNewBidButton(role, true, '/bids')).toBe(false)
    }
  })

  it('no other page draws it, for any role', () => {
    for (const path of ['/', '/dashboard', '/prospects', '/jobs', '/bidsheet', '/estimates', '/settings']) {
      for (const role of ['dev', 'master_technician', 'assistant', 'controller', 'estimator', 'superintendent'] as const) {
        expect(showHeaderNewBidButton(role, false, path)).toBe(false)
      }
    }
    expect(isBidsPagePath('/bids')).toBe(true)
    expect(isBidsPagePath('/bids/gc')).toBe(true)
    expect(isBidsPagePath('/bidsheet')).toBe(false)
    expect(isBidsPagePath('/prospects')).toBe(false)
  })

  it('a primary reads bids and makes none; the field roles have no Bids page', () => {
    for (const role of ['primary', 'helpers', 'subcontractor'] as const) {
      expect(showHeaderNewBidButton(role, false, '/bids')).toBe(false)
    }
    expect(showHeaderNewBidButton(null, false, '/bids')).toBe(false)
  })

  it('Layout draws the header press on this rule alone, with the page it is on', () => {
    const layout = readFileSync(LAYOUT_PATH, 'utf8')
    expect(layout).toMatch(/showHeaderNewBidButton\(role, taskModeActive, location\.pathname\) && \(/)
    expect(layout).not.toMatch(/role === 'estimator' && !taskModeActive && \(/)
  })
})
