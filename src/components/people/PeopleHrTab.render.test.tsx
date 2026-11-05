// @vitest-environment jsdom
/**
 * Render smoke for PeopleHrTab: canned roster, files, entries and the records the app keeps about
 * a person produce the dev-only banner, a grouped roster with entry counts, and — after picking a
 * person — the file: the fact strip, the Timeline with its lane chips and one line per record
 * (an HR entry with its exhibit, a signed paper, a lapsed license, a write-up, the start day), the
 * Evidence list with the entry a file sits on, and the Narrative with the summary's stale banner.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, screen, fireEvent, within } from '@testing-library/react'
import PeopleHrTab from './PeopleHrTab'
import { renderWithProviders } from '../../test/renderSmokeMocks'

const TABLE_ROWS: Record<string, unknown[]> = {
  people: [
    { id: 'p-marcus', name: 'Marcus Reed', kind: 'helper', archived_at: null, start_date: '2025-03-11', end_date: null, account_user_id: 'u-marcus' },
    { id: 'p-danny', name: 'Danny Ortiz', kind: 'helper', archived_at: null, start_date: null, end_date: null, account_user_id: null },
  ],
  person_files: [
    // Summary older than one of Marcus's entries → stale banner + partial coverage.
    { person_id: 'p-marcus', kind: 'summary', content: 'Runs the **rough-in** crew.', updated_at: '2026-08-01T00:00:00.000Z', covered_through: null, author_label: 'HR agent' },
    { person_id: 'p-marcus', kind: 'narrative', content: 'Started as a helper.', updated_at: '2026-08-01T00:00:00.000Z', covered_through: null, author_label: null },
  ],
  person_file_entries: [
    { id: 'e1', person_id: 'p-marcus', entry_date: '2026-07-18', content: 'Sit-down about Master hours.', source: 'review', created_by: 'u-dev', created_at: '2026-07-18T12:00:00.000Z', author_label: null },
    { id: 'e2', person_id: 'p-marcus', entry_date: '2026-08-19', content: 'Re-ran the vent stack on 6th St.', source: 'job_event', created_by: null, created_at: '2026-08-19T12:00:00.000Z', author_label: null },
  ],
  users: [{ id: 'u-dev', name: 'Robert' }, { id: 'u-marcus', name: 'Marcus Reed' }],
  person_file_attachments: [
    { id: 'a1', person_id: 'p-marcus', entry_id: 'e2', storage_path: 'p-marcus/x-vent-photo.jpg', filename: 'vent-photo.jpg', mime_type: 'image/jpeg', size_bytes: 204800, author_label: null, uploaded_by: 'u-dev', created_at: '2026-08-20T00:00:00.000Z' },
    { id: 'a2', person_id: 'p-marcus', entry_id: null, storage_path: 'p-marcus/y-agreement.pdf', filename: 'agreement.pdf', mime_type: 'application/pdf', size_bytes: 1258291, author_label: 'HR agent', uploaded_by: null, created_at: '2026-08-20T00:00:00.000Z' },
  ],
  person_reports: [],
  person_contract_documents: [
    { id: 'c1', document_name: 'Subcontractor Handbook', status: 'signed', created_at: '2026-04-21T05:49:09Z', sent_at: '2026-04-21T19:07:29Z', signed_at: '2026-04-21', office_completed_at: null, signer_printed_name: 'Marcus Reed', expires_at: null, doc_type: 'agreement' },
  ],
  person_licenses: [{ id: 'l1', license_type: 'Plumber Apprentice #1', date_of_expiry: '2020-01-31', created_at: '2026-03-24T17:55:55Z', note: null }],
  writeups: [{ id: 'w1', template_id: 't1', status: 'submitted', disclosure: 'discussed_with_subject', submitted_at: '2026-06-25T21:52:16Z', created_at: '2026-06-25T21:00:00Z', filled_by_user_id: 'u-dev' }],
  writeup_templates: [{ id: 't1', name: 'Insubordination' }],
  attendance_incidents: [],
  attendance_annotations: [],
}

vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock()
})

vi.mock('../../lib/supabase', () => {
  function makeBuilder(rows: unknown[]): Record<string, unknown> {
    const builder: Record<string, unknown> = {}
    for (const m of ['select', 'insert', 'update', 'upsert', 'delete', 'eq', 'in', 'order', 'range', 'limit', 'single', 'maybeSingle']) {
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
      storage: { from: () => ({ upload: () => Promise.resolve({ error: null }) }) },
    },
  }
})

afterEach(cleanup)

async function openMarcus() {
  renderWithProviders(<PeopleHrTab />)
  expect(await screen.findByText(/Dev-only/)).toBeTruthy()
  const marcusRow = (await screen.findAllByRole('button', { name: /Marcus Reed/ }))[0]!
  // Entry count beside the name, in the roster.
  expect(marcusRow.textContent).toMatch(/Marcus Reed\s*2/)
  fireEvent.click(marcusRow)
  expect(await screen.findByRole('tab', { name: /Timeline \(/ })).toBeTruthy()
}

describe('PeopleHrTab · the person file', () => {
  it('draws the fact strip and one Timeline line per record, each on its own day, with the exhibit on its entry', async () => {
    await openMarcus()
    // The strip says only what is there.
    expect(screen.getByText('1 paper signed')).toBeTruthy()
    expect(screen.getByText('1 license expired')).toBeTruthy()
    expect(screen.getByText('1 write-up')).toBeTruthy()
    expect(screen.getByText('2 HR entries')).toBeTruthy()
    // Lane chips carry counts; Missed holds the lapsed license.
    expect(screen.getByRole('button', { name: /^Missed · 1/ })).toBeTruthy()
    // The lines: the HR entries by source, the paper signed by the signer, the license lapsed, the write-up with its disclosure, the start day.
    expect(screen.getByText('Sit-down about Master hours.')).toBeTruthy()
    expect(screen.getByText('review')).toBeTruthy()
    expect(screen.getByText('job event')).toBeTruthy()
    expect(screen.getByText('signed')).toBeTruthy()
    expect(screen.getByText('Subcontractor Handbook')).toBeTruthy()
    expect(screen.getByText('license expired')).toBeTruthy()
    expect(screen.getByText('write-up · discussed with them')).toBeTruthy()
    expect(screen.getByText('Insubordination')).toBeTruthy()
    expect(screen.getByText('Started with the company.')).toBeTruthy()
    // The exhibit linked to e2 sits on that line; the person-level one does not.
    const e2 = screen.getByText('Re-ran the vent stack on 6th St.').closest('li')!
    expect(within(e2).getByRole('button', { name: /vent-photo\.jpg/ })).toBeTruthy()
    expect(within(e2).queryByRole('button', { name: /agreement\.pdf/ })).toBeNull()
    // Months, newest first.
    const headings = screen.getAllByRole('heading', { level: 4 }).map((h) => h.textContent ?? '')
    expect(headings[0]).toMatch(/August 2026/)
    expect(headings.some((h) => /March 2025/.test(h))).toBe(true)
  })

  it('Matter is a dev’s fourth view (v2.6543): with none on the person it says what a matter holds and offers Open a matter…', async () => {
    await openMarcus()
    fireEvent.click(screen.getByTestId('person-file-tab-matter'))
    expect(await screen.findByText('No matter on this person.')).toBeTruthy()
    expect(screen.getByText(/A matter holds the analysis for counsel/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Open a matter…' })).toBeTruthy()
    expect(screen.queryByTestId('person-matter')).toBeNull()
  })

  it('Evidence lists the older files with the entry each sits on and offers the first record; Narrative shows the summary, its stale banner and the story', async () => {
    await openMarcus()
    fireEvent.click(screen.getByRole('tab', { name: /Evidence \(2\)/ }))
    expect(await screen.findByText('agreement.pdf')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Files from before records' })).toBeTruthy()
    const photo = screen.getByText('vent-photo.jpg').closest('li')!
    expect(within(photo).getByText(/on the Aug 19 entry/)).toBeTruthy()
    // The add window asks for every piece: the day, a title, a memo, the files.
    fireEvent.click(screen.getByRole('button', { name: '+ Add evidence' }))
    const dialog = await screen.findByRole('dialog', { name: 'Add evidence' })
    expect(within(dialog).getByText('The day it is about')).toBeTruthy()
    expect(within(dialog).getByPlaceholderText('What this is, in a few words')).toBeTruthy()
    expect(within(dialog).getByPlaceholderText(/What it shows and why it matters/)).toBeTruthy()
    expect(within(dialog).getByText(/Where it goes:/)).toBeTruthy()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Keep the evidence' }))
    expect(await within(dialog).findByRole('alert')).toHaveProperty('textContent', 'Give it a title.')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    fireEvent.click(screen.getByRole('tab', { name: 'Narrative' }))
    expect(await screen.findByText(/rough-in/)).toBeTruthy()
    expect(screen.getByText(/1 newer entry since this was rewritten/)).toBeTruthy()
    expect(screen.getByText('Started as a helper.')).toBeTruthy()
  })

  it('+ Add entry opens the composer, dated the day it happened, appending only', async () => {
    await openMarcus()
    fireEvent.click(screen.getByRole('button', { name: '+ Add entry' }))
    expect(await screen.findByPlaceholderText('What happened. Facts and dates, no guesses.')).toBeTruthy()
    expect(screen.getByText(/Entries append and never change\. A correction is a new entry/)).toBeTruthy()
    const add = screen.getByRole('button', { name: 'Add entry' }) as HTMLButtonElement
    expect(add.disabled).toBe(true)
  })
})
