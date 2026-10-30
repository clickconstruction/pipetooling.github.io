// @vitest-environment jsdom
/**
 * 44 px everywhere a tech presses (punch list #189, PR 3), held at 375 px: the whole-job percent chips, the stage
 * rows' quick picks and steps, and the job window's activity pills on a phone. jsdom lays nothing out, so each is
 * held by the inline height it declares, as the job window's bar test holds its own.
 */
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReportTemplatePercentField } from './ReportTemplatePercentField'
import { ReportLinesProgressField } from './ReportLinesProgressField'
import { StagePctControl } from './reports/StagePctControl'
import { PHONE_PILL_MIN_HEIGHT, PHONE_PRESS_MIN_HEIGHT, activityPillStyle } from '../lib/phonePress'
import type { StageProgressRow } from '../lib/reports/stageProgressReport'

const minHeightPx = (el: HTMLElement) => parseFloat(el.style.minHeight)

const rows: StageProgressRow[] = [
  { fixtureId: 'r', name: 'Rough In', kind: 'order', sequenceOrder: 1, weightPct: 60, progressPct: 35, drawPaid: false },
  { fixtureId: 't', name: 'Top Out', kind: 'order', sequenceOrder: 2, weightPct: 40, progressPct: null, drawPaid: false },
]

describe('the presses a tech makes daily, at 375 px', () => {
  beforeAll375()

  it('the whole-job percent chips stand 44 px', () => {
    render(<ReportTemplatePercentField id="pct" label="How complete is the job?" value="40" onChange={vi.fn()} />)
    const chips = [0, 25, 50, 75, 100].map((p) => screen.getByRole('button', { name: `Set How complete is the job? to ${p} percent` }))
    expect(chips).toHaveLength(5)
    for (const c of chips) expect(minHeightPx(c)).toBeGreaterThanOrEqual(PHONE_PRESS_MIN_HEIGHT)
  })

  it('a stage row’s quick picks stand 48 px and its −5 and +5 56 px, on the report and alone', () => {
    const { unmount } = render(<ReportLinesProgressField rows={rows} picks={{}} openId="r" onOpen={vi.fn()} onPct={vi.fn()} />)
    for (const p of [25, 50, 75, 100]) expect(minHeightPx(screen.getByRole('button', { name: `Set Rough In to ${p} percent` }))).toBeGreaterThanOrEqual(48)
    expect(minHeightPx(screen.getByRole('button', { name: 'Rough In down 5' }))).toBeGreaterThanOrEqual(56)
    expect(minHeightPx(screen.getByRole('button', { name: 'Rough In up 5' }))).toBeGreaterThanOrEqual(56)
    unmount()
    render(<StagePctControl name="Job" value={40} onChange={vi.fn()} />)
    for (const p of [25, 50, 75, 100]) expect(minHeightPx(screen.getByRole('button', { name: `Set Job to ${p} percent` }))).toBeGreaterThanOrEqual(48)
    expect(minHeightPx(screen.getByRole('button', { name: 'Job down 5' }))).toBeGreaterThanOrEqual(56)
    expect(minHeightPx(screen.getByRole('button', { name: 'Job is 40 percent. Tap to type a number' }))).toBeGreaterThanOrEqual(56)
  })

  it('the job window’s activity pills stand 32 px on a phone', () => {
    const narrow = window.matchMedia('(max-width: 640px)').matches
    expect(narrow).toBe(true)
    expect(activityPillStyle(narrow).minHeight).toBe(PHONE_PILL_MIN_HEIGHT)
    expect(PHONE_PILL_MIN_HEIGHT).toBe(32)
  })
})

/** A 375 px phone: the width, and a matchMedia that answers the narrow queries. */
function beforeAll375() {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 375 })
  window.matchMedia = ((query: string) => ({
    matches: /max-width:\s*(\d+)px/.test(query) ? 375 <= Number(/max-width:\s*(\d+)px/.exec(query)![1]) : false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia
}
