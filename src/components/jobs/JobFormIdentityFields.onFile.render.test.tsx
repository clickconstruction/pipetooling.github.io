// @vitest-environment jsdom
/**
 * Render smokes for addresses already on file in the Job Address box (punch list #439, piece 1): the rows the
 * company already has come first in the dropdown with their counts, a pick takes the spelling on file and the
 * line under the box says so, the keys run through both groups, and an address one slip from one on file asks
 * once after the box is left. Every name and address here is made up.
 */
import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { JobFormIdentityFields } from './JobFormIdentityFields'
import { forgetAddressesOnFile } from '../../hooks/useAddressesOnFile'

const invoke = vi.fn()
const tables: Record<string, Record<string, unknown>[]> = {}
const reads: string[] = []
const refuse = { on: false }

vi.mock('../../lib/supabase', () => ({
  supabase: {
    functions: { invoke: (...a: unknown[]) => invoke(...a) },
    from: (table: string) => {
      reads.push(table)
      const answer = refuse.on ? { data: null, error: { message: 'refused' } } : { data: tables[table] ?? [], error: null }
      const chain = { select: () => chain, order: () => chain, range: () => Promise.resolve(answer) }
      return chain
    },
  },
}))

const GOOGLE = {
  suggestions: [{ main: '118 Old Quarter Rd', mainMatchEnd: 12, secondary: 'Exampleville, TX, USA', full: '118 Old Quarter Rd, Exampleville, TX 78000, USA' }],
}

function Harness({ start = '', editingJobId = null }: { start?: string; editingJobId?: string | null }) {
  const [jobAddress, setJobAddress] = useState(start)
  const [jobName, setJobName] = useState('')
  const [hcp, setHcp] = useState('')
  const [click, setClick] = useState('')
  const [svc, setSvc] = useState('')
  return (
    <JobFormIdentityFields
      hcpNumber={hcp}
      setHcpNumber={setHcp}
      clickNumber={click}
      setClickNumber={setClick}
      jobName={jobName}
      setJobName={setJobName}
      jobAddress={jobAddress}
      setJobAddress={setJobAddress}
      editingJobId={editingJobId}
      formServiceTypeId={svc}
      setFormServiceTypeId={setSvc}
      serviceTypeOptions={[{ id: 'p', name: 'Plumbing' }]}
      tradePill={null}
      onTradePillClick={() => {}}
    />
  )
}

const box = () => screen.getByPlaceholderText('Address') as HTMLInputElement

async function type(value: string) {
  fireEvent.focus(box())
  fireEvent.change(box(), { target: { value } })
}

beforeEach(() => {
  cleanup()
  forgetAddressesOnFile()
  reads.length = 0
  refuse.on = false
  invoke.mockReset()
  invoke.mockResolvedValue({ data: GOOGLE, error: null })
  tables.jobs_ledger = [
    { id: 'j1', job_address: '118 Old Quarry Trl, Sampleton, TX', development_id: 'd1' },
    { id: 'j2', job_address: '118 Old Quarry Trl, Sampleton, TX', development_id: 'd1' },
    { id: 'j3', job_address: '118 Old Quarry Trail, Sampleton, TX 78000', development_id: 'd1' },
    { id: 'j4', job_address: '118 Old Quarry Trl Barn, Sampleton, TX', development_id: null },
  ]
  tables.bids = [{ id: 'b1', address: '40 Stone Rd, Placeholder, TX', development_id: null }]
  tables.developments = [{ id: 'd1', name: 'Old Quarry Ranch' }]
})

describe('Job Address: addresses already on file', () => {
  it('reads nothing until the box is first focused', async () => {
    render(<Harness />)
    await Promise.resolve()
    expect(reads).toEqual([])
    fireEvent.focus(box())
    await waitFor(() => expect(reads.sort()).toEqual(['bids', 'developments', 'jobs_ledger']))
  })

  it('lists the addresses on file first, with how many jobs are there, then Google\'s under their own head', async () => {
    render(<Harness />)
    await type('118 old quar')
    await waitFor(() => expect(screen.getAllByTestId('job-address-on-file-row').length).toBe(2))
    expect(screen.getByTestId('job-address-on-file-head').textContent).toBe('Already on file')
    const rows = screen.getAllByTestId('job-address-on-file-row')
    expect(rows[0]?.textContent).toContain('118 Old Quarry Trl, Sampleton, TX')
    expect(rows[0]?.textContent).toContain('3 jobs · Old Quarry Ranch')
    expect(rows[1]?.textContent).toContain('1 job')
    // What was typed is bold on the row that begins that way.
    expect(rows[0]?.querySelector('b')?.textContent).toBe('118 Old Quar')
    await waitFor(() => expect(screen.getByText('A new address')).toBeTruthy())
    expect(screen.getByText('powered by Google')).toBeTruthy()
    // One listbox, the on-file rows first.
    const options = screen.getAllByRole('option')
    expect(options.length).toBe(3)
    expect(options[0]?.getAttribute('aria-selected')).toBe('true')
  })

  it('takes the spelling on file on a press, and says so under the box', async () => {
    render(<Harness />)
    await type('118 old quar')
    await waitFor(() => expect(screen.getAllByTestId('job-address-on-file-row').length).toBe(2))
    fireEvent.mouseDown(screen.getAllByTestId('job-address-on-file-row')[0] as HTMLElement)
    expect(box().value).toBe('118 Old Quarry Trl, Sampleton, TX')
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(screen.getByTestId('job-address-on-file-line').textContent).toBe('✓On file. 3 jobs are at this address, in the development Old Quarry Ranch.')
  })

  it('runs the arrow keys and Enter through both groups', async () => {
    render(<Harness />)
    await type('118 old quar')
    await waitFor(() => expect(screen.getAllByRole('option').length).toBe(3))
    fireEvent.keyDown(box(), { key: 'ArrowDown' })
    expect(screen.getAllByRole('option')[1]?.getAttribute('aria-selected')).toBe('true')
    fireEvent.keyDown(box(), { key: 'Enter' })
    expect(box().value).toBe('118 Old Quarry Trl Barn, Sampleton, TX')
    // Up from the first row wraps to Google's, and Enter takes it the old way.
    await type('118 old quar')
    await waitFor(() => expect(screen.getAllByRole('option').length).toBe(3))
    fireEvent.keyDown(box(), { key: 'ArrowUp' })
    expect(screen.getAllByRole('option')[2]?.getAttribute('aria-selected')).toBe('true')
    fireEvent.keyDown(box(), { key: 'Enter' })
    expect(box().value).toBe('118 Old Quarter Rd, Exampleville, TX 78000')
  })

  it('shows the on-file rows alone when Google has nothing, with no Google line', async () => {
    invoke.mockResolvedValue({ data: { suggestions: [] }, error: null })
    render(<Harness />)
    await type('40 st')
    await waitFor(() => expect(screen.getAllByTestId('job-address-on-file-row').length).toBe(1))
    expect(screen.getByTestId('job-address-on-file-row').textContent).toContain('1 bid')
    expect(screen.queryByText('A new address')).toBeNull()
    expect(screen.queryByText('powered by Google')).toBeNull()
  })

  it('asks once about an address one letter off, after the box is left', async () => {
    render(<Harness />)
    await type('118 Old Quary Trl, Sampleton TX')
    await waitFor(() => expect(reads.length).toBe(3))
    // Quiet while the person is still typing.
    expect(screen.queryByTestId('job-address-close-on-file')).toBeNull()
    fireEvent.blur(box())
    await waitFor(() => expect(screen.getByTestId('job-address-close-on-file')).toBeTruthy())
    expect(screen.getByText('This looks like an address already on file.')).toBeTruthy()
    expect(screen.getByTestId('job-address-close-on-file-words').textContent).toContain('118 Old Quarry Trl, Sampleton, TX · 3 jobs')
    expect(screen.getByText('Keeping yours makes a new place. This job will not match the 3 jobs on file. You can still save.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Use the one on file' }))
    expect(box().value).toBe('118 Old Quarry Trl, Sampleton, TX')
    expect(screen.queryByTestId('job-address-close-on-file')).toBeNull()
    expect(screen.getByTestId('job-address-on-file-line')).toBeTruthy()
  })

  it('Keep mine settles it for that address', async () => {
    render(<Harness />)
    await type('118 Old Quary Trl, Sampleton TX')
    await waitFor(() => expect(reads.length).toBe(3))
    fireEvent.blur(box())
    await waitFor(() => expect(screen.getByTestId('job-address-close-on-file')).toBeTruthy())
    const typed = box().value
    fireEvent.click(screen.getByRole('button', { name: 'Keep mine' }))
    expect(screen.queryByTestId('job-address-close-on-file')).toBeNull()
    expect(box().value).toBe(typed)
    // Leaving the box again does not ask a second time.
    fireEvent.focus(box())
    fireEvent.blur(box())
    expect(screen.queryByTestId('job-address-close-on-file')).toBeNull()
  })

  it('does not count the job being edited at its own address', async () => {
    tables.jobs_ledger = [{ id: 'j9', job_address: '77 Sample Way, Placeholder, TX', development_id: null }]
    render(<Harness start="77 Sample Way, Placeholder, TX" editingJobId="j9" />)
    fireEvent.focus(box())
    await waitFor(() => expect(reads.length).toBe(3))
    fireEvent.blur(box())
    expect(screen.queryByTestId('job-address-on-file-line')).toBeNull()
  })

  it('stays a plain box when the read fails', async () => {
    refuse.on = true
    render(<Harness />)
    await type('118 old quar')
    await waitFor(() => expect(screen.getByText('powered by Google')).toBeTruthy())
    expect(screen.queryByTestId('job-address-on-file-head')).toBeNull()
  })
})
