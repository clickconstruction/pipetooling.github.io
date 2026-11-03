// @vitest-environment jsdom
/**
 * Render smoke for People → Writeups (v2.6433): the list opens on the write-ups and the no-call
 * no-shows with *Show attendance (derived)* unticked, ticking it brings the derived lates into
 * the list, and unticking it takes them out again. The composition is the kernel's
 * (`lib/people/writeupsTimeline.test.ts`); this holds the wiring, over invented people.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders, settle } from '../../test/renderSmokeMocks'
import { appTzWallTimeMs, todayYmdInAppTz, ymdAddDays } from '../../utils/dateUtils'
import { WriteupsContractsSubTab } from './WriteupsContractsSubTab'

const TODAY = todayYmdInAppTz()
const LATE_DAY = ymdAddDays(TODAY, -7)

const TABLE_ROWS: Record<string, unknown[]> = {
  writeup_templates: [{ id: 't-tardy', name: 'Tardiness', description: null, is_active: true, schema: { fields: [] }, created_at: '2026-06-01T00:00:00Z' }],
  writeups: [
    { id: 'w1', template_id: 't-tardy', subject_user_id: 'u-hal', filled_by_user_id: 'u-dev', status: 'submitted', disclosure: 'discussed_with_subject', answers: {}, submitted_at: '2026-10-20T15:00:00Z', created_at: '2026-10-20T15:00:00Z' },
  ],
  attendance_incidents: [
    { id: 'n1', subject_user_id: 'u-pat', work_date: '2026-10-25', created_by_user_id: 'u-dev', created_at: '2026-10-25T20:00:00Z', metadata: { had_approved_sessions: false }, details: null },
  ],
  // A block at 7:00 and a first clock-in at 8:00, app time: one derived late, an hour past the start.
  job_schedule_blocks: [{ assignee_user_id: 'u-hal', work_date: LATE_DAY, time_start: '07:00:00' }],
  clock_sessions: [{ user_id: 'u-hal', work_date: LATE_DAY, clocked_in_at: new Date(appTzWallTimeMs(LATE_DAY, 8, 0)).toISOString(), rejected_at: null, revoked_at: null, origin: 'user_punch' }],
  attendance_annotations: [],
}

vi.mock('../../lib/supabase', () => {
  function makeBuilder(rows: unknown[]): Record<string, unknown> {
    const builder: Record<string, unknown> = {}
    for (const m of ['select', 'insert', 'update', 'upsert', 'delete', 'eq', 'neq', 'gte', 'lte', 'in', 'is', 'order', 'range', 'limit', 'single', 'maybeSingle', 'abortSignal']) {
      builder[m] = () => builder
    }
    builder.then = (onFulfilled?: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
      Promise.resolve({ data: rows, error: null, count: rows.length }).then(onFulfilled, onRejected)
    return builder
  }
  return {
    supabase: {
      from: (table: string) => makeBuilder(TABLE_ROWS[table] ?? []),
      rpc: () => Promise.resolve({ data: null, error: null }),
      functions: { invoke: () => Promise.resolve({ data: null, error: null }) },
    },
  }
})

const USERS = [
  { id: 'u-hal', name: 'Hal Sample' },
  { id: 'u-pat', name: 'Pat Sample' },
  { id: 'u-dev', name: 'Robin Sample' },
]

afterEach(cleanup)

/** The list's rows by their Type cell. */
const rowTypes = () => [...document.querySelectorAll('table tbody tr')].map((tr) => (tr.querySelector('td')?.textContent ?? '').trim())

describe('WriteupsContractsSubTab', () => {
  it('opens on the write-ups and no-shows with the lates off, and the box brings them in and out', async () => {
    renderWithProviders(<WriteupsContractsSubTab users={USERS} userOptions={[]} authUserId="u-dev" isDev myRole="dev" />)
    await waitFor(() => expect(rowTypes()).toContain('Writeup'))
    await settle()

    const box = screen.getByRole('checkbox', { name: 'Show attendance (derived)' }) as HTMLInputElement
    expect(box.checked).toBe(false)
    expect(rowTypes()).toEqual(['NCNS', 'Writeup'])
    expect(document.querySelector('[data-empty-state]')).toBeNull()

    fireEvent.click(box)
    await settle()
    expect(box.checked).toBe(true)
    expect(rowTypes()).toEqual(['◔ Late', 'NCNS', 'Writeup'])
    expect(screen.getByText(`Work date: ${LATE_DAY}`)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Add note' })).toBeTruthy()

    fireEvent.click(box)
    await settle()
    expect(rowTypes()).toEqual(['NCNS', 'Writeup'])
    expect(screen.queryByRole('button', { name: 'Add note' })).toBeNull()
  })

  it('a subject search holds the box’s rule: the person’s lates show only once it is ticked', async () => {
    renderWithProviders(<WriteupsContractsSubTab users={USERS} userOptions={[]} authUserId="u-dev" isDev myRole="dev" />)
    await waitFor(() => expect(rowTypes()).toContain('Writeup'))
    await settle()

    fireEvent.change(screen.getByPlaceholderText('Name…'), { target: { value: 'hal' } })
    await settle()
    expect(rowTypes()).toEqual(['Writeup'])
    expect(document.querySelector('[data-attendance-strip-card]')).toBeNull()

    fireEvent.click(screen.getByRole('checkbox', { name: 'Show attendance (derived)' }))
    await settle()
    expect(rowTypes()).toEqual(['◔ Late', 'Writeup'])
    expect(document.querySelector('[data-attendance-strip-card]')).toBeTruthy()
  })
})
