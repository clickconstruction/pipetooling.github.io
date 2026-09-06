import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  HEADER_ASK_ESTIMATING_LABEL,
  showEstimatorInboxButton,
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
