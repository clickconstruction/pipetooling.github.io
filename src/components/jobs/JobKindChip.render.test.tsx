// @vitest-environment jsdom
/**
 * The job's kind chip (punch list #238): one of three words, each in its own tone, with the
 * kernel's reason as the hover text.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

// The row's shared module reads useAuth and the client at import.
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock()
})
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

import JobKindChip from './JobKindChip'
import { jobKind } from '../../lib/jobs/jobKind'
import { renderStagesJobHcpSubline } from './jobsStagesRowShared'
import { StagesPhoneRow } from './StagesPhoneRow'
import JobsStagesCardList from './JobsStagesCardList'
import { makeJob, renderWithProviders, settle } from '../../test/renderSmokeMocks'
import { makeStagesCardListProps } from '../../test/stagesCardListProps'
import type { JobNextLine } from '../../lib/jobs/jobNextLine'

afterEach(cleanup)

describe('JobKindChip', () => {
  it('reads Project for a bid job, with the reason as its title', () => {
    render(<JobKindChip read={jobKind({ bid_id: 'b1', bidNumber: 'B917', revenue: 112000, firstWorkDate: '2026-09-01' })} />)
    const chip = screen.getByTestId('job-kind-chip')
    expect(chip.textContent).toBe('Project')
    expect(chip.getAttribute('data-kind')).toBe('project')
    expect(chip.getAttribute('title')).toBe('Project · priced $112,000 from bid B917.')
  })

  it('reads Service call for an HCP job and Kind not set for a Click-only job with nothing else', () => {
    render(
      <>
        <JobKindChip read={jobKind({ hcp_number: '9057', firstWorkDate: '2026-09-01' })} />
        <JobKindChip read={jobKind({ click_number: '1031', firstWorkDate: '2026-09-01' })} size="sm" />
      </>,
    )
    const [service, unset] = screen.getAllByTestId('job-kind-chip')
    expect(service!.textContent).toBe('Service call')
    expect(service!.getAttribute('data-kind')).toBe('service')
    expect(unset!.textContent).toBe('Kind not set')
    expect(unset!.getAttribute('data-kind')).toBe('unset')
    expect(unset!.getAttribute('title')).toContain('your call')
  })
})

describe('the Pipeline row', () => {
  it('carries the chip after the number, the saved kind first and the signals after it', () => {
    render(
      <>
        <div data-testid="pressed">{renderStagesJobHcpSubline(makeJob({ hcp_number: '9057', kind: 'project', first_work_date: '2026-09-01' }))}</div>
        <div data-testid="signals">{renderStagesJobHcpSubline(makeJob({ hcp_number: '9057', first_work_date: '2026-09-01' }))}</div>
        <div data-testid="no-number">{renderStagesJobHcpSubline(makeJob({ hcp_number: '', click_number: '', revenue: 0, first_work_date: '2026-09-01' }))}</div>
      </>,
    )
    const chipIn = (id: string) => screen.getByTestId(id).querySelector('[data-testid="job-kind-chip"]')
    expect(chipIn('pressed')!.textContent).toBe('Project')
    expect(chipIn('signals')!.textContent).toBe('Service call')
    expect(chipIn('no-number')!.textContent).toBe('Kind not set')
  })

  it('a phone row leads its second line with the chip, so the first keeps the job name', () => {
    const next: JobNextLine = { line: 'open 2 mo', chip: null, needsMe: false, today: false }
    const job = makeJob({ hcp_number: '9057', job_name: 'ZZ Test Water Heater', first_work_date: '2026-09-01' })
    renderWithProviders(<StagesPhoneRow job={job} next={next} busy={false} flash={false} advance={null} onOpen={() => {}} onChip={() => {}} onMore={() => {}} />)
    const chip = screen.getByTestId('job-kind-chip')
    expect(chip.textContent).toBe('Service call')
    expect(chip.parentElement!.textContent).toContain('open 2 mo')
    expect(chip.parentElement!.textContent).not.toContain('ZZ Test Water Heater')
  })

  it('the Mobile cards carry the chip under the name', async () => {
    const job = makeJob({ hcp_number: '9057', job_name: 'ZZ Test Water Heater', kind: 'project', first_work_date: '2026-09-01' })
    renderWithProviders(<JobsStagesCardList {...makeStagesCardListProps({ jobList: [job] })} />)
    await settle()
    expect(screen.getByTestId('job-kind-chip').textContent).toBe('Project')
  })
})
