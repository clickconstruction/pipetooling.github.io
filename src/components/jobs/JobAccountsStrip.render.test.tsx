// @vitest-environment jsdom
/**
 * Render smokes for the not-needed sheet on the Job accounts strip: a row from the old
 * one-press answer says what it was and reads no reason into it; the stamp line names who
 * marked it and when; the office gets
 * Change this… (the Mark opened window, the reason box empty) and Take the mark off
 * (the row is deleted, the chip goes back to none yet); the field gets neither.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { JobAccountsStrip } from './JobAccountsStrip'
import { NEW_JOB_NOT_NEEDED_NOTE } from '../../lib/jobs/jobAccountsNewJob'
import type { JobAccountStripEntry } from '../../lib/jobs/jobAccountStrip'

const auth = vi.hoisted(() => ({ role: 'assistant' }))
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' }, role: auth.role }) }))

const deleted = vi.hoisted(() => ({ calls: [] as Array<{ table: string; column: string; value: string }> }))
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (table: string) => ({
      delete: () => ({
        eq: (column: string, value: string) => ({
          select: () => {
            deleted.calls.push({ table, column, value })
            return Promise.resolve({ data: [{ id: value }], error: null })
          },
        }),
      }),
    }),
  },
}))
vi.mock('../../lib/physicalInvoiceIssuer', () => ({
  getPhysicalInvoiceIssuerForDocument: () => ({ companyName: 'ZZ Test Plumbing' }),
  fetchPhysicalInvoiceIssuerFromAppSettings: async () => ({ rowExists: true }),
}))

function entry(extra: Partial<JobAccountStripEntry> = {}): JobAccountStripEntry {
  return {
    houseId: 'moore',
    houseName: 'ZZ Moore',
    policy: 'expects',
    state: 'not_needed',
    accountId: 'acct-1',
    accountRef: '',
    openedVia: null,
    openedAt: null,
    requestedAt: null,
    requestedFromCounter: false,
    note: NEW_JOB_NOT_NEEDED_NOTE,
    rep: null,
    ...extra,
  }
}

function openSheet(entries: JobAccountStripEntry[], onChanged = vi.fn()) {
  renderWithProviders(<JobAccountsStrip jobId="j1" jobLabel="9302 · ZZ Test job" jobAddress={null} entries={entries} onChanged={onChanged} />)
  fireEvent.click(screen.getByRole('button', { name: /ZZ Moore/ }))
  return onChanged
}

afterEach(() => {
  auth.role = 'assistant'
  deleted.calls = []
})

describe('JobAccountsStrip, the not-needed sheet', () => {
  it('says what the old one-press answer was, and Change this… opens Mark opened with the reason box empty', async () => {
    openSheet([entry()])
    expect(screen.getByText('Marked not needed when the job was made. No reason was given.')).toBeTruthy()
    expect(screen.queryByText(/The office decided/)).toBeNull()

    fireEvent.click(screen.getByTestId('job-account-change-this'))
    const why = (await screen.findByLabelText(/Why not/)) as HTMLTextAreaElement
    expect(why.value).toBe('')
    expect((screen.getByRole('button', { name: 'Mark not needed' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.queryByText('Marked not needed when the job was made. No reason was given.')).toBeNull()
  })

  it('reads a typed reason as the office decision, and Change this… carries it', async () => {
    openSheet([entry({ note: 'Service call' })])
    expect(screen.getByText('The office decided this job does not need an account at ZZ Moore: Service call')).toBeTruthy()
    fireEvent.click(screen.getByTestId('job-account-change-this'))
    expect(((await screen.findByLabelText(/Why not/)) as HTMLTextAreaElement).value).toBe('Service call')
  })

  it('says who marked it and when under the sentence, and only the day for a row marked before the stamp', () => {
    openSheet([entry({ note: 'Service call', notNeededBy: 'Tess', notNeededAt: '2026-11-13T19:24:44Z' })])
    expect(screen.getByText('Marked by Tess on Nov 13, 2026.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))

    fireEvent.click(screen.getByRole('button', { name: /ZZ Moore/ }))
    expect(screen.getByText('Marked by Tess on Nov 13, 2026.')).toBeTruthy()
  })

  it('says only the day on an old row, and nothing where there is no stamp', () => {
    openSheet([entry({ notNeededBy: null, notNeededAt: '2026-10-07T22:13:03Z' })])
    expect(screen.getByText('Marked not needed when the job was made. No reason was given.')).toBeTruthy()
    expect(screen.getByText('Marked on Oct 7, 2026.')).toBeTruthy()
  })

  it('draws no stamp line when the row carries none', () => {
    openSheet([entry()])
    expect(document.querySelector('[data-job-account-not-needed-stamp]')).toBeNull()
  })

  it('Take the mark off deletes the row and tells the host to read again', async () => {
    const onChanged = openSheet([entry()])
    fireEvent.click(screen.getByTestId('job-account-take-mark-off'))
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1))
    expect(deleted.calls).toEqual([{ table: 'job_supply_house_accounts', column: 'id', value: 'acct-1' }])
    expect(await screen.findByText('ZZ Moore is back to none yet for 9302 · ZZ Test job.')).toBeTruthy()
    expect(screen.queryByTestId('job-account-change-this')).toBeNull()
  })

  it('gives the field the words and neither press', () => {
    auth.role = 'subcontractor'
    openSheet([entry()])
    expect(screen.getByText('Marked not needed when the job was made. No reason was given.')).toBeTruthy()
    expect(screen.queryByTestId('job-account-change-this')).toBeNull()
    expect(screen.queryByTestId('job-account-take-mark-off')).toBeNull()
  })
})

describe('JobAccountsStrip — foldNone (punch list #384)', () => {
  const none = (houseId: string, houseName: string) => entry({ houseId, houseName, state: 'none', accountId: null, note: undefined })

  it('folds houses that all read none yet to one line, and a press opens the chips as they were', () => {
    renderWithProviders(<JobAccountsStrip jobId="j1" jobLabel="9302 · ZZ Test job" jobAddress={null} entries={[none('moore', 'ZZ Moore'), none('reece', 'ZZ Reece'), none('ferg', 'ZZ Ferguson')]} foldNone />)
    const fold = screen.getByRole('button', { name: /none yet at 3 houses/ })
    expect(fold.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByRole('button', { name: /ZZ Moore/ })).toBeNull()
    fireEvent.click(fold)
    expect(screen.queryByRole('button', { name: /none yet at 3 houses/ })).toBeNull()
    expect(screen.getByRole('button', { name: /ZZ Moore/ }).getAttribute('data-job-account-state')).toBe('none')
    expect(screen.getByRole('button', { name: /ZZ Reece/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /ZZ Ferguson/ })).toBeTruthy()
  })

  it('keeps every chip when a house is open, and without the prop', () => {
    const first = renderWithProviders(<JobAccountsStrip jobId="j1" jobLabel="9302 · ZZ Test job" jobAddress={null} entries={[none('moore', 'ZZ Moore'), entry({ houseId: 'reece', houseName: 'ZZ Reece', state: 'open', note: undefined })]} foldNone />)
    expect(screen.queryByRole('button', { name: /none yet at/ })).toBeNull()
    expect(screen.getByRole('button', { name: /ZZ Moore/ })).toBeTruthy()
    first.unmount()
    renderWithProviders(<JobAccountsStrip jobId="j1" jobLabel="9302 · ZZ Test job" jobAddress={null} entries={[none('moore', 'ZZ Moore'), none('reece', 'ZZ Reece')]} />)
    expect(screen.queryByRole('button', { name: /none yet at/ })).toBeNull()
    expect(screen.getByRole('button', { name: /ZZ Moore/ })).toBeTruthy()
  })
})
