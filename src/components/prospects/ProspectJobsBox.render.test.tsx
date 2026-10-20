// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { ProspectJobsBox } from './ProspectJobsBox'
import type { ProspectJob } from '../../lib/prospects/gcLeadLane'

const job = (over: Partial<ProspectJob> & { id: string; name: string }): ProspectJob => ({
  prospect_id: 'p-1',
  address: null,
  sq_ft: null,
  size_note: null,
  plans_link: null,
  bid_due: null,
  status: 'open',
  won_by: null,
  note: null,
  created_at: '2026-10-01',
  ...over,
})

const jobs = [
  job({ id: 'ti', name: 'Office TI', address: '210 Lantana Dr' }),
  job({ id: 'lost', name: 'Field house', status: 'lost', won_by: 'Keller Build' }),
  job({ id: 'shell', name: 'Retail shell', address: '4400 FM 1431', sq_ft: 12000, bid_due: '2026-11-03', plans_link: 'https://planhub.example/x' }),
]

function mount(over: Partial<Parameters<typeof ProspectJobsBox>[0]> = {}) {
  const props = {
    jobs,
    todayYmd: '2026-10-15',
    busy: false,
    onAdd: vi.fn(async () => {}),
    onEdit: vi.fn(async () => {}),
    onLost: vi.fn(),
    onStatus: vi.fn(),
    onRemove: vi.fn(),
    ...over,
  }
  render(<ProspectJobsBox {...props} />)
  return props
}

describe('ProspectJobsBox (v2.5561)', () => {
  afterEach(cleanup)

  it('lists open jobs soonest bid first, then the lost one, each with its day', () => {
    mount()
    const box = screen.getByRole('region', { name: 'Jobs' })
    const rows = box.querySelectorAll('[data-job-status]')
    expect([...rows].map((r) => r.textContent)).toEqual([
      expect.stringContaining('Retail shell'),
      expect.stringContaining('Office TI'),
      expect.stringContaining('Field house'),
    ])
    expect(rows[0]?.textContent).toContain('Nov 3')
    expect(rows[0]?.textContent).toContain('bids due · 19 days')
    expect(rows[0]?.textContent).toContain('12,000 sq ft')
    expect(within(rows[0] as HTMLElement).getByRole('link', { name: 'the plans' }).getAttribute('href')).toBe('https://planhub.example/x')
    expect(rows[1]?.textContent).toContain('when they say')
    expect(rows[2]?.textContent).toContain('to Keller Build')
  })

  it('offers Lost and Drop on an open job, Reopen and Remove on a lost one', () => {
    const props = mount()
    const rows = screen.getByRole('region', { name: 'Jobs' }).querySelectorAll('[data-job-status]')
    fireEvent.click(within(rows[0] as HTMLElement).getByRole('button', { name: 'Lost' }))
    expect(props.onLost).toHaveBeenCalledWith(expect.objectContaining({ id: 'shell' }))
    fireEvent.click(within(rows[1] as HTMLElement).getByRole('button', { name: 'Drop' }))
    expect(props.onStatus).toHaveBeenCalledWith(expect.objectContaining({ id: 'ti' }), 'dropped')
    fireEvent.click(within(rows[2] as HTMLElement).getByRole('button', { name: 'Reopen' }))
    expect(props.onStatus).toHaveBeenCalledWith(expect.objectContaining({ id: 'lost' }), 'open')
    fireEvent.click(within(rows[2] as HTMLElement).getByRole('button', { name: 'Remove' }))
    expect(props.onRemove).toHaveBeenCalledWith(expect.objectContaining({ id: 'lost' }))
    expect(within(rows[2] as HTMLElement).queryByRole('button', { name: 'Lost' })).toBeNull()
  })

  it('says what to do when the lead has no job yet', () => {
    mount({ jobs: [] })
    expect(screen.getByText(/No job yet/)).toBeTruthy()
    expect(screen.getByText('Jobs (0)')).toBeTruthy()
  })

  it('holds a job with no name or a link that is not a web address, and says why', () => {
    const props = mount({ jobs: [] })
    fireEvent.click(screen.getByRole('button', { name: '+ Add a job' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save the job' }))
    expect(screen.getByRole('alert').textContent).toBe('Give the job a name.')
    fireEvent.change(screen.getByLabelText('Job'), { target: { value: 'Retail shell' } })
    fireEvent.change(screen.getByLabelText('Where the plans are (a link)'), { target: { value: 'planhub.example/x' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save the job' }))
    expect(screen.getByRole('alert').textContent).toBe('The plans link starts with http:// or https://.')
    expect(props.onAdd).not.toHaveBeenCalled()
  })

  it('saves what was typed and closes; a refusal stays open with its words', async () => {
    const props = mount({ jobs: [] })
    fireEvent.click(screen.getByRole('button', { name: '+ Add a job' }))
    fireEvent.change(screen.getByLabelText('Job'), { target: { value: '  Retail shell ' } })
    fireEvent.change(screen.getByLabelText('Address'), { target: { value: '4400 FM 1431, Cedar Park' } })
    fireEvent.change(screen.getByLabelText('Size (sq ft)'), { target: { value: '12000' } })
    fireEvent.change(screen.getByLabelText('Bids due'), { target: { value: '2026-11-03' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save the job' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Save the job' })).toBeNull())
    expect(props.onAdd).toHaveBeenCalledWith({ name: 'Retail shell', address: '4400 FM 1431, Cedar Park', sq_ft: 12000, size_note: null, plans_link: null, bid_due: '2026-11-03' })

    cleanup()
    mount({ jobs: [], onAdd: vi.fn(async () => { throw new Error('new row violates row-level security policy') }) })
    fireEvent.click(screen.getByRole('button', { name: '+ Add a job' }))
    fireEvent.change(screen.getByLabelText('Job'), { target: { value: 'Retail shell' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save the job' }))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('new row violates row-level security policy'))
    expect(screen.getByRole('button', { name: 'Save the job' })).toBeTruthy()
  })

  it('Edit turns an open row into the form filled in, and Save changes sends only what changed (v2.5580)', async () => {
    const props = mount()
    const box = screen.getByRole('region', { name: 'Jobs' })
    const shell = [...box.querySelectorAll('[data-job-status]')][0] as HTMLElement
    fireEvent.click(within(shell).getByRole('button', { name: 'Edit' }))
    expect(box.querySelector('[data-job-form="edit"]')).toBeTruthy()
    expect((screen.getByLabelText('Job') as HTMLInputElement).value).toBe('Retail shell')
    expect((screen.getByLabelText('Bids due') as HTMLInputElement).value).toBe('2026-11-03')
    expect((screen.getByLabelText('Size (sq ft)') as HTMLInputElement).value).toBe('12000')
    expect(screen.queryByRole('button', { name: '+ Add a job' })).toBeTruthy()
    expect(screen.getByText('Editing Retail shell')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Bids due'), { target: { value: '2026-11-11' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Save changes' })).toBeNull())
    expect(props.onEdit).toHaveBeenCalledWith(jobs[2], { name: 'Retail shell', address: '4400 FM 1431', sq_ft: 12000, size_note: null, plans_link: 'https://planhub.example/x', bid_due: '2026-11-11' })
    expect(props.onAdd).not.toHaveBeenCalled()
  })

  it('Cancel puts the row back as it was; a lost job has no Edit; + Add a job closes an edit', () => {
    mount()
    const box = screen.getByRole('region', { name: 'Jobs' })
    const rows = () => [...box.querySelectorAll('[data-job-status]')] as HTMLElement[]
    expect(within(rows()[2] as HTMLElement).queryByRole('button', { name: 'Edit' })).toBeNull()
    fireEvent.click(within(rows()[0] as HTMLElement).getByRole('button', { name: 'Edit' }))
    fireEvent.change(screen.getByLabelText('Job'), { target: { value: 'Something else' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(box.querySelector('[data-job-form]')).toBeNull()
    expect(rows()[0]?.textContent).toContain('Retail shell')
    fireEvent.click(within(rows()[0] as HTMLElement).getByRole('button', { name: 'Edit' }))
    fireEvent.click(screen.getByRole('button', { name: '+ Add a job' }))
    expect(box.querySelector('[data-job-form="edit"]')).toBeNull()
    expect(box.querySelector('[data-job-form="add"]')).toBeTruthy()
    expect((screen.getByLabelText('Job') as HTMLInputElement).value).toBe('')
  })
})
