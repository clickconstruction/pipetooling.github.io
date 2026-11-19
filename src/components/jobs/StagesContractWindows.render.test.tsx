// @vitest-environment jsdom
/**
 * The Pipeline's three contract windows, drawn by one host (the Stages map's step 24). The windows have their own
 * tests; here each is a probe that records what the host hands it, so the cases pin the wiring: which window opens
 * on which state, what each close and save does, and what the GC sheet is told about the job. Made-up jobs.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'

type Props = Record<string, unknown>
const seen = vi.hoisted(() => ({ contract: [] as Props[], sheet: [] as Props[], sweep: [] as Props[] }))
vi.mock('./JobContractModal', () => ({ default: (p: Props) => (seen.contract.push(p), <div data-testid="contract-window" data-open={String(p.open)} />) }))
vi.mock('./AddJobContractSheet', () => ({ default: (p: Props) => (seen.sheet.push(p), <div data-testid="gc-paper-sheet" />) }))
vi.mock('./JobsContractSweepModal', () => ({ default: (p: Props) => (seen.sweep.push(p), <div data-testid="contract-sweep" data-open={String(p.open)} />) }))

import { StagesContractWindows } from './StagesContractWindows'
import type { JobContractCoverage } from '../../lib/jobs/jobContractCoverage'
import { jobNumberLabel, streetOf } from '../../lib/jobs/jobContractCovers'
import { makeJob } from '../../test/renderSmokeMocks'

const last = (list: Props[]) => list[list.length - 1]!
const gcJob = () =>
  makeJob({ id: 'gc-job', job_name: 'Builder Duplex', hcp_number: '878', job_address: '12 Made Up Lane, Faketown, TX 78000', gc_customer_id: 'gc-1', gcCustomer: { id: 'gc-1', name: '  Made Up Builders  ' } })

function host(over: Partial<Parameters<typeof StagesContractWindows>[0]> = {}) {
  const props = {
    jobContractModalJob: null,
    setJobContractModalJob: vi.fn(),
    gcPaperSheetJob: null,
    setGcPaperSheetJob: vi.fn(),
    contractSweepOpen: false,
    setContractSweepOpen: vi.fn(),
    jobs: [],
    jobContractCoverageByJobId: new Map<string, JobContractCoverage>(),
    contractFloorCents: 0,
    loadJobContractCoverage: vi.fn(),
    loadJobs: vi.fn(),
    openEdit: vi.fn(),
    setStagesContractFilter: vi.fn(),
    ...over,
  }
  const view = render(<StagesContractWindows {...props} />)
  return { props, view }
}

afterEach(() => {
  cleanup()
  seen.contract = []
  seen.sheet = []
  seen.sweep = []
})

describe('StagesContractWindows', () => {
  it('with nothing open, the Contract window and the sweep are mounted shut and the GC sheet is not drawn', () => {
    const { view } = host()
    expect(view.getByTestId('contract-window').getAttribute('data-open')).toBe('false')
    expect(last(seen.contract).job).toBeNull()
    expect(last(seen.contract).coverage).toBeNull()
    expect(view.queryByTestId('gc-paper-sheet')).toBeNull()
    expect(view.getByTestId('contract-sweep').getAttribute('data-open')).toBe('false')
  })

  it('the Contract window opens on its job with that job’s coverage, and its presses reach the tab', () => {
    const job = makeJob({ id: 'c-job', job_name: 'Contract Villa' })
    const coverage = { kind: 'none' } as JobContractCoverage
    const other = { kind: 'signed' } as unknown as JobContractCoverage
    const { props } = host({ jobContractModalJob: job, jobContractCoverageByJobId: new Map([['c-job', coverage], ['x', other]]) })
    const p = last(seen.contract)
    expect(p.open).toBe(true)
    expect(p.job).toBe(job)
    expect(p.coverage).toBe(coverage)
    ;(p.onClose as () => void)()
    expect(props.setJobContractModalJob).toHaveBeenCalledWith(null)
    ;(p.onChanged as () => void)()
    expect(props.loadJobContractCoverage).toHaveBeenCalledTimes(1)
    ;(p.onJobChanged as () => void)()
    expect(props.loadJobs).toHaveBeenCalledTimes(1)
    ;(p.onEditJob as (j: unknown) => void)(job)
    expect(props.openEdit).toHaveBeenCalledWith(job)
  })

  it('a job with no coverage on file opens with none', () => {
    host({ jobContractModalJob: makeJob({ id: 'bare' }) })
    expect(last(seen.contract).coverage).toBeNull()
  })

  it('the GC sheet adds the subcontract for the job’s GC, named by the job’s number and street', () => {
    const job = gcJob()
    host({ gcPaperSheetJob: job })
    const p = last(seen.sheet)
    expect(p.open).toBe(true)
    expect(p.mode).toBe('add')
    expect(p.anchorJob).toEqual({ id: 'gc-job', num: jobNumberLabel(job), where: streetOf(job.job_address) })
    expect(p.partyIds).toEqual(['gc-1'])
    expect(p.signerName).toBe('Made Up Builders')
    expect(p.subtitle).toBe(`Job ${jobNumberLabel(job)} · Made Up Builders's subcontract`)
  })

  it('a job with no GC on file names no party, and the subtitle says the GC', () => {
    host({ gcPaperSheetJob: makeJob({ id: 'no-gc', gc_customer_id: null, gcCustomer: null }) })
    const p = last(seen.sheet)
    expect(p.partyIds).toEqual([])
    expect(p.signerName).toBe('')
    expect(String(p.subtitle)).toMatch(/· the GC's subcontract$/)
  })

  it('the GC sheet’s close, its save and its door to the Contract window', () => {
    const job = gcJob()
    const { props } = host({ gcPaperSheetJob: job })
    const p = last(seen.sheet)
    ;(p.onClose as () => void)()
    expect(props.setGcPaperSheetJob).toHaveBeenCalledWith(null)
    const heard = vi.fn()
    window.addEventListener('job-contract-changed', heard)
    ;(p.onDone as () => void)()
    window.removeEventListener('job-contract-changed', heard)
    expect(props.loadJobContractCoverage).toHaveBeenCalledTimes(1)
    expect(heard).toHaveBeenCalledTimes(1)
    vi.mocked(props.setGcPaperSheetJob).mockClear()
    ;(p.onOpenContractWindow as () => void)()
    expect(props.setGcPaperSheetJob).toHaveBeenCalledWith(null)
    expect(props.setJobContractModalJob).toHaveBeenCalledWith(job)
  })

  it('the sweep reads the board’s jobs, the coverage and the floor, and its presses reach the tab', () => {
    const jobs = [makeJob({ id: 's1' }), makeJob({ id: 's2' })]
    const coverage = new Map<string, JobContractCoverage>([['s1', { kind: 'none' } as JobContractCoverage]])
    const { props } = host({ contractSweepOpen: true, jobs, jobContractCoverageByJobId: coverage, contractFloorCents: 250000 })
    const p = last(seen.sweep)
    expect(p.open).toBe(true)
    expect(p.jobs).toBe(jobs)
    expect(p.coverage).toBe(coverage)
    expect(p.floorCents).toBe(250000)
    ;(p.onClose as () => void)()
    expect(props.setContractSweepOpen).toHaveBeenLastCalledWith(false)
    ;(p.onSent as () => void)()
    expect(props.loadJobContractCoverage).toHaveBeenCalledTimes(1)
    ;(p.onJobChanged as () => void)()
    expect(props.loadJobs).toHaveBeenCalledTimes(1)
    ;(p.onEditJob as (j: unknown) => void)(jobs[1])
    expect(props.openEdit).toHaveBeenCalledWith(jobs[1])
  })

  it('the sweep’s last press shuts it and filters the board to the jobs with nothing on file', () => {
    const { props } = host({ contractSweepOpen: true })
    vi.mocked(props.setContractSweepOpen).mockClear()
    ;(last(seen.sweep).onFilterBoard as () => void)()
    expect(props.setContractSweepOpen).toHaveBeenCalledWith(false)
    expect(props.setStagesContractFilter).toHaveBeenCalledWith('missing')
  })
})
