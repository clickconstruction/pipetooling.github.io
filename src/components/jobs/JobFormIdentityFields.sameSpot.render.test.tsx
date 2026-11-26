// @vitest-environment jsdom
/**
 * Render smokes for the job form's question about a place (punch list #439, piece 2, its last part): an address
 * that is not on file, at the same spot on the map as one that is, asks once after the box is left. Each of the
 * three presses does its one thing, a refused answer says why and the question stays, and nobody is asked whose
 * answer would not be kept. Every name, address and point here is made up.
 */
import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { JobFormIdentityFields } from './JobFormIdentityFields'
import { forgetAddressesOnFile } from '../../hooks/useAddressesOnFile'
import { forgetPlaceAnswers } from '../../hooks/useSameSpotOnFile'

type Row = Record<string, unknown>
const db = vi.hoisted(() => ({
  role: 'assistant' as string,
  tables: {} as Record<string, Record<string, unknown>[]>,
  cached: null as { lat: number; lng: number } | null,
  upserts: [] as unknown[],
  refuse: false,
  invoke: vi.fn(),
}))

vi.mock('../../hooks/useAuth', () => ({ useOptionalAuth: () => ({ role: db.role, user: { id: 'u1' }, loading: false }) }))
vi.mock('../../lib/supabase', () => ({
  supabase: {
    functions: { invoke: (name: string, opts: unknown) => db.invoke(name, opts) },
    from: (table: string) => {
      const all = () => Promise.resolve({ data: db.tables[table] ?? [], error: null })
      const chain = {
        select: () => chain,
        order: () => chain,
        eq: () => chain,
        gte: () => chain,
        lte: () => chain,
        // Every row of a table, a page at a time: the addresses on file and the answers.
        range: all,
        // The map's points in the box around the typed address.
        limit: all,
        // The pin line's own look in the cache for the typed address.
        maybeSingle: async () => ({ data: db.cached, error: null }),
        upsert: (row: Row) => {
          db.upserts.push(row)
          return Promise.resolve({ error: db.refuse ? { message: 'new row violates row-level security policy for table "address_place_answers"' } : null })
        },
      }
      return chain
    },
  },
}))

const ON_FILE = '412 Sample Canyon Dr Building 20, Exampleville, TX'
const TYPED = '412 Sample Canyon Dr Building 16, Exampleville, TX'
const KEY_ON_FILE = '412 sample canyon drive building 20 exampleville tx'
const KEY_TYPED = '412 sample canyon drive building 16 exampleville tx'
const SPOT = { lat: 32, lng: -98 }

function Harness({ start = '' }: { start?: string }) {
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
      formServiceTypeId={svc}
      setFormServiceTypeId={setSvc}
      serviceTypeOptions={[{ id: 'p', name: 'Plumbing' }]}
      tradePill={null}
      onTradePillClick={() => {}}
    />
  )
}

const box = () => screen.getByPlaceholderText('Address') as HTMLInputElement
const question = () => screen.queryByTestId('job-address-same-spot')

/** Type an address and leave the box, as a person does. */
async function typeAndLeave(value: string) {
  fireEvent.focus(box())
  fireEvent.change(box(), { target: { value } })
  // The pin line has looked in the cache by the time the box is left.
  await waitFor(() => expect(document.querySelector('[data-job-address-pin]')).not.toBeNull())
  fireEvent.blur(box())
}

beforeEach(() => {
  cleanup()
  forgetAddressesOnFile()
  forgetPlaceAnswers()
  db.role = 'assistant'
  db.cached = SPOT
  db.upserts.length = 0
  db.refuse = false
  db.invoke.mockReset()
  db.invoke.mockResolvedValue({ data: { suggestions: [] }, error: null })
  db.tables.jobs_ledger = [
    { id: 'j1', job_address: ON_FILE, development_id: null },
    { id: 'j2', job_address: ON_FILE, development_id: null },
    { id: 'j3', job_address: ON_FILE, development_id: null },
  ]
  db.tables.bids = []
  db.tables.developments = []
  db.tables.address_place_answers = []
  db.tables.address_geocodes = [{ address_normalized: ON_FILE.toLowerCase(), ...SPOT }]
})

describe('Job Address: written differently, the same spot on the map', () => {
  it('asks once the box is left, with both spellings and what is on file there', async () => {
    render(<Harness />)
    fireEvent.focus(box())
    fireEvent.change(box(), { target: { value: TYPED } })
    await waitFor(() => expect(document.querySelector('[data-job-address-pin]')).not.toBeNull())
    // Quiet while the box has the focus.
    await new Promise((r) => setTimeout(r, 30))
    expect(question()).toBeNull()
    fireEvent.blur(box())
    await waitFor(() => expect(question()).not.toBeNull())
    expect(screen.getByRole('group', { name: 'Is this the same place?' })).toBeTruthy()
    expect(screen.getByTestId('job-address-same-spot-line').textContent).toBe(`3 jobs are on file at this spot as ${ON_FILE}.`)
    expect(screen.getByTestId('job-address-same-spot-typed').textContent).toBe(TYPED)
    expect(screen.getByTestId('job-address-same-spot-on-file').textContent).toBe(ON_FILE)
    for (const name of ['Same place, use that spelling', 'Same place, keep mine', 'Not the same']) expect(screen.getByRole('button', { name })).toBeTruthy()
    expect(db.upserts).toEqual([])
  })

  it('Same place, keep mine keeps the answer, leaves the address as typed and says what it is kept with', async () => {
    render(<Harness />)
    await typeAndLeave(TYPED)
    await waitFor(() => expect(question()).not.toBeNull())
    fireEvent.click(screen.getByRole('button', { name: 'Same place, keep mine' }))
    await waitFor(() => expect(question()).toBeNull())
    expect(db.upserts).toEqual([{ key_a: KEY_TYPED, key_b: KEY_ON_FILE, same: true }])
    expect(box().value).toBe(TYPED)
    expect(screen.getByTestId('job-address-same-place-line').textContent).toBe(`✓Kept as the same place as ${ON_FILE}. 3 jobs are there.`)
  })

  it('Not the same keeps that answer and asks no more', async () => {
    render(<Harness />)
    await typeAndLeave(TYPED)
    await waitFor(() => expect(question()).not.toBeNull())
    fireEvent.click(screen.getByRole('button', { name: 'Not the same' }))
    await waitFor(() => expect(question()).toBeNull())
    expect(db.upserts).toEqual([{ key_a: KEY_TYPED, key_b: KEY_ON_FILE, same: false }])
    expect(screen.queryByTestId('job-address-same-place-line')).toBeNull()
    expect(box().value).toBe(TYPED)
  })

  it('Same place, use that spelling rewrites the field and keeps no answer', async () => {
    render(<Harness />)
    await typeAndLeave(TYPED)
    await waitFor(() => expect(question()).not.toBeNull())
    fireEvent.click(screen.getByRole('button', { name: 'Same place, use that spelling' }))
    await waitFor(() => expect(box().value).toBe(ON_FILE))
    expect(question()).toBeNull()
    expect(db.upserts).toEqual([])
    expect(screen.getByTestId('job-address-on-file-line').textContent).toContain('On file. 3 jobs are at this address.')
  })

  it('a refused answer says why and the question stays', async () => {
    db.refuse = true
    render(<Harness />)
    await typeAndLeave(TYPED)
    await waitFor(() => expect(question()).not.toBeNull())
    fireEvent.click(screen.getByRole('button', { name: 'Not the same' }))
    const alert = await screen.findByRole('alert')
    expect((alert.textContent ?? '').length).toBeGreaterThan(10)
    expect(question()).not.toBeNull()
    expect(screen.queryByTestId('job-address-same-place-line')).toBeNull()
  })

  it('takes the point from the look-up when the cache has none', async () => {
    db.cached = null
    db.invoke.mockImplementation(async (name: string) =>
      name === 'geocode-one'
        ? { data: { ok: true, address_normalized: TYPED.toLowerCase(), ...SPOT, fromCache: false, source: 'google', county: 'Sample' }, error: null }
        : { data: { suggestions: [] }, error: null },
    )
    render(<Harness />)
    await typeAndLeave(TYPED)
    await waitFor(() => expect(question()).not.toBeNull(), { timeout: 4000 })
    expect(screen.getByTestId('job-address-same-spot-line').textContent).toContain('3 jobs are on file at this spot')
  })

  it('stays quiet for a pair already answered, an address far away, and someone whose answer is not kept', async () => {
    db.tables.address_place_answers = [{ key_a: KEY_TYPED, key_b: KEY_ON_FILE, same: false, by_name: 'Cora Sample', answered_at: '2026-11-24T15:00:00Z' }]
    const first = render(<Harness />)
    await typeAndLeave(TYPED)
    await new Promise((r) => setTimeout(r, 60))
    expect(question()).toBeNull()
    first.unmount()

    forgetPlaceAnswers()
    db.tables.address_place_answers = []
    db.cached = { lat: 32.01, lng: -98 }
    const second = render(<Harness />)
    await typeAndLeave(TYPED)
    await new Promise((r) => setTimeout(r, 60))
    expect(question()).toBeNull()
    second.unmount()

    db.cached = SPOT
    db.role = 'estimator'
    render(<Harness />)
    await typeAndLeave(TYPED)
    await new Promise((r) => setTimeout(r, 60))
    expect(question()).toBeNull()
    expect(db.upserts).toEqual([])
  })
})
