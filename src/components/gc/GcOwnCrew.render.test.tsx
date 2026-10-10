// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { GcOwnCrewCard, type OwnCrewWrites } from './GcOwnCrew'
import { ownCrewWords, withCrewPercents, type CrewJobRead, type CrewStageRow } from '../../lib/gc/crewJobRows'
import type { CrewJobHit } from '../../lib/gc/crewJobIo'
import { initialGcState } from '../../lib/gc/schedule/testState'
import { plainWordsFailures } from '../../lib/plainWords'
import { installDomShims } from '../../test/renderSmokeMocks'

installDomShims()

const stage = (name: string, pct: number | null, at: string | null): CrewStageRow => ({ fixture_id: name, name, stage_kind: 'any', sequence_order: 0, weight_pct: 25, progress_pct: pct, progress_at: at, draw_paid: false })
const read = (over: Partial<CrewJobRead> = {}): CrewJobRead => ({ packageId: 'fplumb', jobId: 'job-1088', label: 'J 1088', name: 'Fair Oaks D plumbing', stages: [], reportPct: null, reportedOn: null, pctComplete: null, ...over })
const stages = [stage('Underground', 100, '2026-09-02T15:00:00Z'), stage('Rough In', 60, '2026-10-06T15:00:00Z'), stage('Top Out', 0, null), stage('Trim', null, null)]
const hit = (id: string, label: string): CrewJobHit => ({ id, label, name: `Job ${label}`, address: '12 Main St' })

/** Fair Oaks D's plumbing with a read laid over it, as the page lays it over the board. */
function plumbing(r: CrewJobRead | null) {
  const s = r ? withCrewPercents(initialGcState(), [r]) : initialGcState()
  return s.projects.find((p) => p.id === 'fairoaksd')!.packages.find((k) => k.id === 'fplumb')!
}
function writesFn(): { [K in keyof OwnCrewWrites]: ReturnType<typeof vi.fn> } {
  return {
    onLink: vi.fn(() => Promise.resolve(true)),
    onSearch: vi.fn(() => Promise.resolve([hit('job-2', 'J 2001')])),
    onSuggest: vi.fn(() => Promise.resolve([hit('job-1', 'J 1088')])),
  }
}

describe('GcOwnCrewCard', () => {
  it('reads each stage from the Pipeline job, with the day it was reported, and nothing to type', () => {
    const r = read({ stages })
    render(<GcOwnCrewCard pkg={plumbing(r)} linked read={r} />)
    expect(screen.getByText('Pipeline job J 1088')).toBeTruthy()
    const rough = document.querySelector('[data-own-crew-stage="fplumb-2"]')!
    expect(rough.textContent).toContain('60% · Oct 6')
    expect(document.querySelector('[data-own-crew-stage="fplumb-3"]')!.textContent).toMatch(/0%$/)
    expect(document.querySelector('[data-own-crew-words]')!.textContent).toBe('Each stage reads its percent from Pipeline job J 1088. The whole trade follows from the stages.')
    expect(screen.queryByRole('combobox')).toBeNull()
    expect(screen.queryByRole('spinbutton')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Change' })).toBeNull()
  })

  it('says when the whole trade reads the job’s report or its own percent, and shows no stages then', () => {
    const r = read({ reportPct: 55, reportedOn: '2026-10-08' })
    render(<GcOwnCrewCard pkg={plumbing(r)} linked read={r} />)
    expect(document.querySelector('[data-own-crew-stage]')).toBeNull()
    expect(document.querySelector('[data-own-crew-words]')!.textContent).toBe('Pipeline job J 1088 has no stage to read for each of ours. The whole trade reads its crew report of Oct 8.')
    expect(screen.getByText('55% done')).toBeTruthy()
  })

  it('a dev picks the job: the suggested one first, then a search, and Use this job links it', async () => {
    const writes = writesFn()
    render(<GcOwnCrewCard pkg={plumbing(null)} linked={false} read={null} writes={writes} />)
    expect(screen.getByText('No Pipeline job yet')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Pick its Pipeline job' }))
    const picker = document.querySelector('[data-crew-job-picker]') as HTMLElement
    await waitFor(() => expect(picker.querySelector('[data-crew-job-hit="job-1"]')).toBeTruthy())
    expect(writes.onSuggest).toHaveBeenCalledWith('fplumb')
    fireEvent.change(within(picker).getByRole('textbox', { name: 'Find the Pipeline job' }), { target: { value: '2001' } })
    await waitFor(() => expect(picker.querySelector('[data-crew-job-hit="job-2"]')).toBeTruthy())
    expect(writes.onSearch).toHaveBeenCalledWith('2001')
    fireEvent.click(within(picker.querySelector('[data-crew-job-hit="job-2"]') as HTMLElement).getByRole('button', { name: 'Use this job' }))
    await waitFor(() => expect(writes.onLink).toHaveBeenCalledWith('fplumb', 'job-2'))
    await waitFor(() => expect(document.querySelector('[data-crew-job-picker]')).toBeNull())
  })

  it('a dev unlinks a linked job, and a search that finds nothing says so', async () => {
    const writes = writesFn()
    writes.onSearch.mockResolvedValueOnce([])
    const r = read({ pctComplete: 30 })
    render(<GcOwnCrewCard pkg={plumbing(r)} linked read={r} writes={writes} />)
    fireEvent.click(screen.getByRole('button', { name: 'Change' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Find the Pipeline job' }), { target: { value: 'zz' } })
    expect(await screen.findByText('No job matches. Try its number.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Unlink it' }))
    await waitFor(() => expect(writes.onLink).toHaveBeenCalledWith('fplumb', null))
  })

  it('shows a job another crew trade holds below the free ones, and does not let it be picked (call 11)', async () => {
    const writes = writesFn()
    writes.onSuggest.mockResolvedValueOnce([hit('job-8', 'J 1300'), hit('job-1', 'J 1088')])
    render(<GcOwnCrewCard pkg={plumbing(null)} linked={false} read={null} held={{ 'job-8': 'Electrical' }} writes={writes} />)
    fireEvent.click(screen.getByRole('button', { name: 'Pick its Pipeline job' }))
    const picker = document.querySelector('[data-crew-job-picker]') as HTMLElement
    await waitFor(() => expect(picker.querySelectorAll('[data-crew-job-hit]').length).toBe(2))
    expect([...picker.querySelectorAll('[data-crew-job-hit]')].map((li) => li.getAttribute('data-crew-job-hit'))).toEqual(['job-1', 'job-8'])
    const held = picker.querySelector('[data-crew-job-hit="job-8"]') as HTMLElement
    expect(held.textContent).toContain('On Electrical already')
    const use = within(held).getByRole('button', { name: 'Use this job' }) as HTMLButtonElement
    expect(use.disabled).toBe(true)
    fireEvent.click(use)
    expect(writes.onLink).not.toHaveBeenCalled()
  })

  it('holds the job our general conditions are spent on too, so a crew cannot pick it (O11b)', async () => {
    const writes = writesFn()
    writes.onSuggest.mockResolvedValueOnce([hit('job-gc', 'J 1080'), hit('job-1', 'J 1088')])
    render(<GcOwnCrewCard pkg={plumbing(null)} linked={false} read={null} held={{ 'job-gc': 'general conditions' }} writes={writes} />)
    fireEvent.click(screen.getByRole('button', { name: 'Pick its Pipeline job' }))
    const picker = document.querySelector('[data-crew-job-picker]') as HTMLElement
    await waitFor(() => expect(picker.querySelectorAll('[data-crew-job-hit]').length).toBe(2))
    const held = picker.querySelector('[data-crew-job-hit="job-gc"]') as HTMLElement
    expect(held.textContent).toContain('On general conditions already')
    expect((within(held).getByRole('button', { name: 'Use this job' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('says each thing a first-timer reads in plain words', () => {
    const said = [
      ownCrewWords(plumbing(null), false, null),
      ownCrewWords(plumbing(read({ stages })), true, read({ stages })),
      ownCrewWords(plumbing(read({ reportPct: 55, reportedOn: '2026-10-08' })), true, read({ reportPct: 55, reportedOn: '2026-10-08' })),
      ownCrewWords(plumbing(read({ pctComplete: 30 })), true, read({ pctComplete: 30 })),
      ownCrewWords(plumbing(read()), true, read()),
      'We pay our own crew through payroll. There are no draws, retainage or waivers here.',
      'No job matches. Try its number.',
    ]
    for (const words of said) expect(plainWordsFailures(words), words).toEqual([])
  })
})
