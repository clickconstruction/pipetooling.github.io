// @vitest-environment jsdom
/**
 * GC mode, the schedule's PR 15b: *Your schedule* in the customer's portal (G-90 to G-93). It opens a job being built,
 * above our contract and the change orders (call 7); a job with no schedule draws as before; a GC or an owner's rep may
 * see every bar; and the payload's parser keeps only the answer's fields, so a broken schedule never reaches the page.
 * The sample job's schedule, What customers see's, reads through the same parser.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { PortalGcJobs } from './PortalGcJobs'
import { parsePortalGcJob, parsePortalGcSchedule, type PortalGcJob, type PortalGcSchedule } from '../../lib/portal/portalPayload'
import { sampleGcSchedule } from '../../../supabase/functions/_shared/customerSampleFixtures'
import { plainWordsFailures } from '../../lib/plainWords'
import { installDomShims } from '../../test/renderSmokeMocks'

installDomShims()
afterEach(cleanup)

const TODAY = '2026-10-12'
const SCHEDULE: PortalGcSchedule = {
  ...sampleGcSchedule(TODAY),
  everyBar: true,
  groups: [{ title: 'Structure', start: '2026-09-29', finish: '2026-10-19', now: true, open: true, bars: [{ label: 'Steel columns', start: '2026-09-29', finish: '2026-10-09', words: 'done', tone: 'green' }, { label: 'Roof deck', start: '2026-10-12', finish: '2026-10-19', words: 'on plan', tone: 'grey' }] }],
}
const JOB: PortalGcJob = {
  projectId: 'p-shell',
  name: 'Retail Shell',
  changeOrders: [{ id: 'co-2', number: 2, description: 'Add a coffee bar cabinet', price: 1100, days: 3, sentOn: '2026-10-07' }],
  canAccept: false,
  accepted: null,
  schedule: SCHEDULE,
}
const usd = (n: number) => `$${n.toLocaleString('en-US')}`

describe('Your schedule in the customer’s portal (PR 15b)', () => {
  it('opens the job being built, above the change orders, with the finish, the stages, the dates, what changed and what we need', () => {
    render(<PortalGcJobs token="tok-1234567890abcdef" jobs={[JOB]} formatUsd={usd} />)
    const block = screen.getByTestId('portal-gc-schedule')
    // First in the job, before the change order's row.
    expect(block.compareDocumentPosition(screen.getByTestId('portal-gc-co-2')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(within(block).getByText('Your schedule')).toBeTruthy()
    expect(within(block).getByText('We finish')).toBeTruthy()
    expect(block.querySelectorAll('[data-portal-gc-stage]')).toHaveLength(6)
    expect(block.querySelector('[data-portal-gc-dates]')!.textContent).toContain('Substantial completion')
    expect(within(block).getByText('Structure is 2 days later than planned, because of the weather. The finish holds.')).toBeTruthy()
    expect(within(block).getByText('What we need from you')).toBeTruthy()
    expect(block.textContent).not.toContain('$')
  })

  it('draws a job with no schedule as before', () => {
    const { schedule: _schedule, ...without } = JOB
    render(<PortalGcJobs token="tok-1234567890abcdef" jobs={[without]} formatUsd={usd} />)
    expect(screen.queryByTestId('portal-gc-schedule')).toBeNull()
    expect(screen.getByTestId('portal-gc-co-2')).toBeTruthy()
  })

  it('shows every bar, by name, dates and their words, to a GC or an owner’s rep', () => {
    render(<PortalGcJobs token="tok-1234567890abcdef" jobs={[JOB]} formatUsd={usd} />)
    const block = screen.getByTestId('portal-gc-schedule')
    expect(block.querySelector('[data-portal-gc-every-bar]')).toBeNull()
    fireEvent.click(within(block).getByRole('button', { name: 'See every bar' }))
    const every = block.querySelector('[data-portal-gc-every-bar]') as HTMLElement
    expect(every.textContent).toContain('Steel columns')
    expect(every.textContent).toContain('on plan')
    expect(within(block).getByRole('button', { name: 'Back to the stages' })).toBeTruthy()
    cleanup()
    render(<PortalGcJobs token="tok-1234567890abcdef" jobs={[{ ...JOB, schedule: { ...SCHEDULE, everyBar: false, groups: [] } }]} formatUsd={usd} />)
    expect(screen.queryByRole('button', { name: 'See every bar' })).toBeNull()
  })

  it('shows the kernel’s sentences as they come, and names its own parts in plain words', () => {
    render(<PortalGcJobs token="tok-1234567890abcdef" jobs={[JOB]} formatUsd={usd} />)
    const block = screen.getByTestId('portal-gc-schedule')
    // The customer's words are the lifted kernel's (customerSchedule.ts), shown as they come.
    for (const sentence of [...SCHEDULE.changes, ...SCHEDULE.asks, SCHEDULE.finishWords]) expect(block.textContent).toContain(sentence)
    for (const label of ['Your schedule', 'We finish', 'Work done', 'Next for you', 'Dates to meet', 'See every bar', 'Back to the stages', 'What changed this week', 'What we need from you']) {
      expect(plainWordsFailures(label), label).toEqual([])
    }
  })
})

describe('the schedule as the payload reads it', () => {
  it('keeps the sample’s schedule whole, and only the answer’s fields', () => {
    expect(parsePortalGcSchedule(JSON.parse(JSON.stringify(sampleGcSchedule(TODAY))))).toEqual(sampleGcSchedule(TODAY))
    const planted = { ...SCHEDULE, company: 'Frame Right', groups: [{ ...SCHEDULE.groups[0]!, sub: 'Frame Right', bars: [{ ...SCHEDULE.groups[0]!.bars[0]!, spare: 12, company: 'Frame Right' }] }] }
    expect(JSON.stringify(parsePortalGcSchedule(planted))).not.toContain('Frame Right')
    expect(JSON.stringify(parsePortalGcSchedule(planted))).not.toContain('spare')
  })

  it('drops a broken schedule, and the job still reads', () => {
    expect(parsePortalGcSchedule({ stages: [] })).toBeNull()
    const job = parsePortalGcJob({ ...JOB, schedule: { finishWords: 7 } })
    expect(job?.name).toBe('Retail Shell')
    expect(job && 'schedule' in job).toBe(false)
  })
})
