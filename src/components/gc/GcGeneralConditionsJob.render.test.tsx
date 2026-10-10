// @vitest-environment jsdom
/**
 * GC mode, Owner Billing's O11b: general conditions' Pipeline job on Our number. With none named it offers the
 * Pipeline's search; a job a crew trade already holds comes last with no press; Use this job names one; once named it
 * says which, with Change and Let it go.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { GcGeneralConditionsJob } from './GcGeneralConditionsJob'
import { installDomShims } from '../../test/renderSmokeMocks'

installDomShims()

const hits = [
  { id: 'j-crew', label: 'J 1071', name: 'Oak Ridge plumbing', address: '12 Mill Rd' },
  { id: 'j-gc', label: 'J 1080', name: 'Oak Ridge general conditions', address: '12 Mill Rd' },
]

describe('GcGeneralConditionsJob', () => {
  it('names a job from the Pipeline’s search, a crew’s job last and not offered', async () => {
    const onName = vi.fn(async (_id: string | null) => {})
    const search = vi.fn(async (_text: string) => hits)
    render(<GcGeneralConditionsJob jobId={null} jobLabel={null} heldBy={{ 'j-crew': 'Plumbing' }} onName={onName} search={search} />)
    expect(screen.getByText('Name the Pipeline job general conditions are spent on, so Money counts what they really cost.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Name the Pipeline job' }))
    fireEvent.change(screen.getByLabelText('Find a Pipeline job by its number, name or address'), { target: { value: 'Oak Ridge' } })
    fireEvent.click(screen.getByRole('button', { name: 'Find' }))
    await waitFor(() => expect(search).toHaveBeenCalledWith('Oak Ridge'))
    const rows = await screen.findAllByText(/^J 10/)
    expect(rows.map((r) => r.textContent)).toEqual(['J 1080', 'J 1071'])
    const crew = document.querySelector('[data-gc-pipeline-job="j-crew"]') as HTMLElement
    expect(within(crew).getByText('On Plumbing already')).toBeTruthy()
    expect(within(crew).queryByRole('button', { name: 'Use this job' })).toBeNull()
    fireEvent.click(within(document.querySelector('[data-gc-pipeline-job="j-gc"]') as HTMLElement).getByRole('button', { name: 'Use this job' }))
    await waitFor(() => expect(onName).toHaveBeenCalledWith('j-gc'))
  })

  it('once named, says which, and lets it go', async () => {
    const onName = vi.fn(async (_id: string | null) => {})
    render(<GcGeneralConditionsJob jobId="j-gc" jobLabel="J 1080" heldBy={{}} onName={onName} search={async () => []} />)
    const block = document.querySelector('[data-gc-general-conditions-job]') as HTMLElement
    expect(block.textContent).toContain('General conditions are spent on Pipeline job J 1080.')
    fireEvent.click(screen.getByRole('button', { name: 'Let it go' }))
    await waitFor(() => expect(onName).toHaveBeenCalledWith(null))
  })

  it('says the refusal in its own words', async () => {
    const onName = vi.fn(async () => {
      throw new Error('Only the money team names it.')
    })
    render(<GcGeneralConditionsJob jobId="j-gc" jobLabel="J 1080" heldBy={{}} onName={onName} search={async () => []} />)
    fireEvent.click(screen.getByRole('button', { name: 'Let it go' }))
    expect(await screen.findByText('Only the money team names it.')).toBeTruthy()
  })
})
