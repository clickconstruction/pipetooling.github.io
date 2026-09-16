// @vitest-environment jsdom
/**
 * Render smokes for SubmittalShareModal (Submittals stage 4a): the first Share mints the
 * room with a 48-hex token and copies its link, names the people typed (a personal token
 * each, watching → may_decide false), runs the before-it-goes steps, marks the revision
 * shared and the earlier shared one superseded; a second Share reuses the room.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'

import { renderWithProviders } from '../../test/renderSmokeMocks'
import { SubmittalShareModal } from './SubmittalShareModal'
import type { SubmittalRevisionRow } from '../../lib/submittals/submittalRevision'
import type { SubmittalRoomRow } from '../../lib/submittals/submittalRoom'

type Rec = { table: string; op: string; payload: unknown; filters: Array<[string, unknown]> }
const state: { writes: Rec[] } = { writes: [] }

vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'wendi' }, role: 'estimator' }) }))

function builder(table: string) {
  const rec: Rec = { table, op: 'select', payload: null, filters: [] }
  const b: Record<string, unknown> = {}
  const chain = () => b
  b.select = chain
  b.eq = (c: string, v: unknown) => { rec.filters.push([c, v]); return b }
  b.neq = (c: string, v: unknown) => { rec.filters.push([`neq:${c}`, v]); return b }
  b.insert = (p: unknown) => { rec.op = 'insert'; rec.payload = p; return b }
  b.upsert = (p: unknown) => { rec.op = 'upsert'; rec.payload = p; return b }
  b.update = (p: unknown) => { rec.op = 'update'; rec.payload = p; return b }
  const run = () => {
    state.writes.push(rec)
    if (rec.op === 'insert' && table === 'bid_submittal_rooms') return { data: { id: 'room-1', ...(rec.payload as object) }, error: null }
    return { data: null, error: null }
  }
  b.single = () => Promise.resolve(run())
  b.then = (res: (v: unknown) => void, rej?: (e: unknown) => void) => Promise.resolve(run()).then(res, rej)
  return b
}
vi.mock('../../lib/supabase', () => ({ supabase: { from: (t: string) => builder(t) } }))

const revision = { id: 'rev-2', bid_id: 'b398', rev_number: 2, status: 'draft', title: 'x', note: null, package_path: 'p', source_files: [], shared_at: null, shared_by: null, job_ledger_id: null, created_by: null, created_at: '', updated_at: '' } as SubmittalRevisionRow

describe('SubmittalShareModal', () => {
  it('mints the room, names a person, runs the before-it-goes steps, marks the revision shared', async () => {
    state.writes = []
    const writeText = vi.fn(() => Promise.resolve())
    Object.assign(navigator, { clipboard: { writeText } })
    const done = vi.fn(() => Promise.resolve())
    const build = vi.fn(() => Promise.resolve())
    const shared = vi.fn()
    renderWithProviders(<SubmittalShareModal bidId="b398" revision={revision} room={null} untrimmedFiles={1} onClose={() => {}} onDoneWithFiles={done} onBuildPackage={build} onShared={shared} />)
    expect(screen.getByRole('dialog', { name: 'Share Rev 2' })).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Name 1'), { target: { value: 'Dana Whitfield' } })
    fireEvent.change(screen.getByLabelText('Email 1'), { target: { value: 'Dana@Whitfield-Arch.com' } })
    fireEvent.click(screen.getByRole('button', { name: '+ another person' }))
    fireEvent.change(screen.getByLabelText('Name 2'), { target: { value: 'Logan Parsons' } })
    fireEvent.change(screen.getByLabelText('Email 2'), { target: { value: 'logan@structura.com' } })
    fireEvent.change(screen.getByLabelText('Role 2'), { target: { value: 'builder' } })
    fireEvent.click(screen.getByLabelText('Watching 2'))
    fireEvent.click(screen.getByRole('button', { name: 'Share Rev 2 · mint the link' }))
    await waitFor(() => expect(shared).toHaveBeenCalled())
    expect(done).toHaveBeenCalledTimes(1)
    expect(build).toHaveBeenCalledTimes(1)
    const room = state.writes.find((w) => w.table === 'bid_submittal_rooms' && w.op === 'insert')!.payload as { token: string; status: string; shared_by: string }
    expect(room.token).toMatch(/^[0-9a-f]{48}$/)
    expect(room).toMatchObject({ status: 'open', shared_by: 'wendi' })
    const people = state.writes.find((w) => w.table === 'bid_submittal_people' && w.op === 'insert')!.payload as Array<Record<string, unknown>>
    expect(people.map((p) => [p.name, p.email, p.role, p.may_decide, p.how])).toEqual([
      ['Dana Whitfield', 'dana@whitfield-arch.com', 'architect', true, 'named'],
      ['Logan Parsons', 'logan@structura.com', 'builder', false, 'named'],
    ])
    expect(people.every((p) => /^[0-9a-f]{48}$/.test(String(p.token)))).toBe(true)
    const revWrites = state.writes.filter((w) => w.table === 'bid_submittals' && w.op === 'update')
    expect(revWrites[0]!.payload).toEqual({ status: 'superseded' })
    expect(revWrites[0]!.filters).toEqual([['bid_id', 'b398'], ['status', 'shared'], ['neq:id', 'rev-2']])
    expect(revWrites[1]!.payload).toMatchObject({ status: 'shared', shared_by: 'wendi' })
    expect(state.writes.find((w) => w.table === 'bid_submittal_events')!.payload).toMatchObject({ room_id: 'room-1', submittal_id: 'rev-2', event_type: 'shared' })
    expect(writeText).toHaveBeenCalledWith(expect.stringMatching(/\/submittal\?t=[0-9a-f]{48}$/))
  })

  it('a second Share reuses the room and shows its link', async () => {
    state.writes = []
    const room = { id: 'room-1', bid_id: 'b398', token: 'ab'.repeat(24), status: 'open', shared_by: 'wendi', shared_at: '2026-09-16T00:00:00Z', closed_by: null, closed_at: null, created_at: '', updated_at: '' } as SubmittalRoomRow
    renderWithProviders(<SubmittalShareModal bidId="b398" revision={{ ...revision, rev_number: 3, id: 'rev-3' }} room={room} untrimmedFiles={0} onClose={() => {}} onDoneWithFiles={() => Promise.resolve()} onBuildPackage={() => Promise.resolve()} onShared={() => {}} />)
    expect(screen.getByTestId('room-link').textContent).toMatch(/\/submittal\?t=abab/)
    expect((screen.getByLabelText(/Keep only|Every vendor file/) as HTMLInputElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Share Rev 3' }))
    await waitFor(() => expect(state.writes.some((w) => w.table === 'bid_submittals')).toBe(true))
    expect(state.writes.some((w) => w.table === 'bid_submittal_rooms' && w.op === 'insert')).toBe(false)
    expect(state.writes.some((w) => w.table === 'bid_submittal_people' && w.op === 'insert')).toBe(false)
  })
})
