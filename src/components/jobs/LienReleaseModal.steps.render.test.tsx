// @vitest-environment jsdom
/**
 * The Release of Lien window in six steps (v2.4314): the rail's states, the one blue thing to do,
 * a problem in step 1 holding the rest (and its ways out), a blank detail holding signing, a
 * waiver waiting at the leader's desk. Job 650's numbers.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { makeInvoice, makeJob, renderWithProviders, settle } from '../../test/renderSmokeMocks'
import LienReleaseModal from './LienReleaseModal'

vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'assistant-1' }, role: 'assistant', profileName: 'Taunya' }) }))
vi.mock('signature_pad', () => ({ default: class { off() {} clear() {} isEmpty() { return true } toDataURL() { return null } } }))

const db = vi.hoisted(() => ({ releases: [] as Array<Record<string, unknown>> }))
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  const stub = makeSupabaseStub() as { from: (t: string) => unknown }
  const realFrom = stub.from.bind(stub)
  stub.from = (table: string) => {
    if (table === 'users') {
      const builder: Record<string, unknown> = {}
      for (const m of ['select', 'eq', 'order', 'in', 'is', 'limit']) builder[m] = () => builder
      builder.then = (ok: (v: unknown) => unknown) => Promise.resolve({ data: [{ id: 'master-1', name: 'Malachi Whites', notes: null, archived_at: null }], error: null }).then(ok)
      return builder
    }
    if (table !== 'job_lien_releases') return realFrom(table)
    const builder: Record<string, unknown> = {}
    // An update answers with the row as saved (the first release, changed), like the database does.
    let wrote: Record<string, unknown> | null = null
    for (const m of ['select', 'eq', 'order', 'in', 'is', 'limit', 'insert']) builder[m] = () => builder
    builder.update = (payload: Record<string, unknown>) => {
      wrote = payload
      return builder
    }
    builder.single = () => Promise.resolve({ data: wrote && db.releases[0] ? { ...db.releases[0], ...wrote } : null, error: null })
    builder.maybeSingle = () => Promise.resolve({ data: null, error: null })
    builder.then = (ok: (v: unknown) => unknown) => Promise.resolve({ data: db.releases, error: null }).then(ok)
    return builder
  }
  return { supabase: stub }
})

const bill1 = makeInvoice({ id: 'b1', status: 'billed', amount: 26800, sequence_order: 0, billed_at: '2026-07-15T22:05:23Z' })
const bill2 = makeInvoice({ id: 'b2', status: 'billed', amount: 6700, sequence_order: 1, billed_at: '2026-09-10T20:32:42Z' })
const job = makeJob({
  id: 'j650',
  hcp_number: '650',
  job_name: 'ATI Schertz — As per plans',
  customer_name: 'SCHERTZ STATION LTD',
  gc_customer_id: 'gc-loberg',
  gcCustomer: { id: 'gc-loberg', name: 'Loberg Contracting' },
  master_user_id: 'master-1',
  invoices: [bill1, bill2],
  revenue: 33500,
  payments: [
    { id: 'p1', job_id: 'j650', invoice_id: 'b1', amount: 11700, paid_on: '2026-09-14', sent_on: null, created_at: '2026-09-14T15:00:00Z', payment_type: 'checkDeposit', sequence_order: 0 },
    { id: 'p2', job_id: 'j650', invoice_id: 'b1', amount: 6077.51, paid_on: '2026-09-28', sent_on: null, created_at: '2026-09-28T15:00:00Z', payment_type: 'checkDeposit', sequence_order: 1 },
  ],
} as never)

const SIGNED = {
  id: 'signed-1',
  job_id: 'j650',
  form_type: 'conditional_final',
  status: 'signed',
  amount: 15722.49,
  invoice_ids: ['b1', 'b2'],
  voided_at: null,
  created_at: '2026-10-01T02:17:32Z',
  minted_at: '2026-10-01T02:17:40Z',
  signed_at: '2026-10-01T02:19:10Z',
  signer_printed_name: 'Malachi Whites',
  signer_signature_mode: 'draw',
  fields: {},
}

const AWAITING = {
  id: 'ask-1',
  job_id: 'j650',
  form_type: 'unconditional_progress',
  status: 'awaiting_signature',
  amount: 17777.51,
  invoice_ids: ['b1'],
  voided_at: null,
  created_at: '2026-10-01T18:00:00Z',
  minted_at: '2026-10-01T18:00:00Z',
  signature_requested_at: '2026-10-01T18:00:00Z',
  signer_user_id: 'master-1',
  fields: { amount: '17777.51', companyName: 'Click Plumbing and Electrical', projectDescription: 'ATI Schertz', throughDate: '2026-07-15', signedDate: '2026-10-01', signerName: 'Malachi Whites', signerTitle: '' },
}

afterEach(() => {
  cleanup()
  db.releases = []
})

const step = (n: number) => screen.getByTestId(`lien-step-${n}`)
const open650 = async () => {
  renderWithProviders(<LienReleaseModal open onClose={() => undefined} job={job} invoice={bill1} signerNameFallback="Malachi Whites" />)
  await screen.findByTestId('lien-step-1')
  await settle()
}

describe('LienReleaseModal — six steps (v2.4314)', () => {
  it('a filled draft: steps 1–4 done, step 5 is the one to do, step 6 opens once he signs', async () => {
    await open650()
    expect([1, 2, 3, 4, 5, 6].map((n) => step(n).getAttribute('data-state'))).toEqual(['done', 'done', 'done', 'done', 'now', 'wait'])
    expect(step(5).getAttribute('aria-current')).toBe('step')
    expect(within(step(1)).getByRole('heading', { name: '1 · Pick the bills' })).toBeTruthy()
    expect(within(step(6)).getByRole('heading', { name: '6 · Send it to Loberg Contracting' })).toBeTruthy()
    expect(step(6).textContent).toContain('Opens once he signs')
    expect((within(step(6)).getByRole('button', { name: 'Send to Loberg Contracting' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByTestId('lien-release-where').textContent).toBe('You are on step 5 of 6 · Get it signed')
    // The page marks the part step 5 fills.
    expect(screen.getByTestId('lien-waiver-foot').textContent).toContain('5 · He signs here')
    // The two ways to sign, and paper as the quiet third.
    expect(within(step(5)).getByRole('button', { name: '✍ He is here, he signs now' })).toBeTruthy()
    expect(within(step(5)).getByRole('button', { name: 'Send it to his desk' })).toBeTruthy()
    expect(within(step(5)).getByRole('button', { name: 'Mark issued' })).toBeTruthy()
    // Step 2 carries the paid money nobody has waived yet.
    expect(within(step(2)).getByTestId('lien-waiver-paid-unwaived')).toBeTruthy()
    // The details read as a list until Change a detail.
    expect(within(step(4)).getByTestId('lien-waiver-details').textContent).toContain('Contractor / releasing partyClickConstruction LLC')
    expect(screen.queryByLabelText('Contractor / releasing party')).toBeNull()
  })

  it('the bill already waived: step 1 needs you, steps 2–6 fold to their titles, the page greys; Make it anyway goes on', async () => {
    db.releases = [SIGNED]
    await open650()
    expect(step(1).getAttribute('data-state')).toBe('warn')
    expect([2, 3, 4, 5, 6].every((n) => step(n).textContent?.includes('Waits for step 1'))).toBe(true)
    expect(screen.queryByTestId('lien-waiver-form')).toBeNull()
    expect(screen.getByTestId('lien-release-where').textContent).toBe('Step 1 needs you')
    expect(screen.getByText('Greyed until step 1 is settled.')).toBeTruthy()
    // Already on this job, above the steps.
    expect(screen.getByTestId('lien-release-already').textContent).toContain('$15,722.49')
    fireEvent.click(within(step(1)).getByRole('button', { name: 'Make it anyway' }))
    await waitFor(() => expect(step(5).getAttribute('data-state')).toBe('now'))
    expect(step(1).getAttribute('data-state')).toBe('done')
  })

  it('the bill already waived: Waive the paid money instead switches the form and frees the steps', async () => {
    db.releases = [SIGNED]
    await open650()
    fireEvent.click(within(step(1)).getByRole('button', { name: 'Waive the $17,777.51 already paid instead ›' }))
    await waitFor(() => expect(step(1).getAttribute('data-state')).toBe('done'))
    expect(within(step(2)).getByRole('button', { name: 'Unconditional' }).getAttribute('aria-pressed')).toBe('true')
    expect((screen.getByLabelText('Amount ($)') as HTMLInputElement).value).toBe('17,777.51')
    expect(step(5).getAttribute('data-state')).toBe('now')
  })

  it('a blank detail: step 4 needs you, and step 5 waits greyed with its buttons off until it is filled', async () => {
    await open650()
    fireEvent.click(within(step(4)).getByRole('button', { name: 'Change a detail' }))
    const contractor = screen.getByLabelText('Contractor / releasing party') as HTMLInputElement
    fireEvent.change(contractor, { target: { value: '' } })
    await waitFor(() => expect(step(4).getAttribute('data-state')).toBe('warn'))
    expect(step(5).textContent).toContain('Waits for step 4')
    expect((within(step(5)).getByTestId('lien-waiver-sign-now') as HTMLButtonElement).closest('fieldset')?.disabled).toBe(true)
    expect(screen.getByTestId('lien-release-where').textContent).toBe('Step 4 needs you')
    fireEvent.change(screen.getByLabelText('Contractor / releasing party'), { target: { value: 'Click Plumbing and Electrical' } })
    await waitFor(() => expect(step(5).getAttribute('data-state')).toBe('now'))
  })

  it('waiting at his desk: steps 1–4 fold to one line each and step 5 says who it waits for', async () => {
    db.releases = [AWAITING]
    await open650()
    await waitFor(() => expect(step(5).textContent).toContain('Waiting for Malachi Whites to sign'))
    expect(step(1).querySelector('[data-folded="true"]')?.textContent).toContain('#1')
    expect(step(2).querySelector('[data-folded="true"]')?.textContent).toContain('Unconditional · progress')
    expect(step(3).querySelector('[data-folded="true"]')?.textContent).toContain('$17,777.51')
    expect(within(step(5)).getByRole('button', { name: 'Cancel request' })).toBeTruthy()
    expect(within(step(5)).queryByRole('button', { name: 'Send it to his desk' })).toBeNull()
    expect(within(step(5)).getByRole('button', { name: '✍ He is here, he signs now' })).toBeTruthy()
  })

  it('click to look (v2.4337): a folded step opens read-only, says how to change it, marks its part of the page, and folds again', async () => {
    db.releases = [AWAITING]
    await open650()
    await waitFor(() => expect(step(5).textContent).toContain('Waiting for Malachi Whites to sign'))
    // Step 3 folded: open it from its card.
    fireEvent.click(within(step(3)).getByRole('button', { name: '3 · Check the amount' }))
    await waitFor(() => expect(within(step(3)).getByTestId('lien-waiver-math')).toBeTruthy())
    expect(step(3).textContent).toContain('Read only while it waits for his signature. To change it, click Cancel request in step 5 first.')
    expect((within(step(3)).getByLabelText('Amount ($)') as HTMLInputElement).disabled).toBe(true)
    // The page marks the amount that step filled in.
    expect(document.querySelector('.lienRelease-preview')?.getAttribute('data-look-part')).toBe('amount')
    expect(screen.getAllByTestId('lien-waiver-amount-mark')[0]?.textContent).toBe('$17,777.51')
    // Step 4 from its number on the rail: the details list, and the page marks the project line.
    fireEvent.click(step(4).querySelector('.lienStep-dot')!)
    await waitFor(() => expect(within(step(4)).getByTestId('lien-waiver-details')).toBeTruthy())
    expect(document.querySelector('.lienRelease-preview')?.getAttribute('data-look-part')).toBe('project')
    expect(screen.getAllByTestId('lien-waiver-amount-mark')[0]?.textContent).toBe('ATI Schertz')
    // Nothing in a looked-at step can change the waiver.
    expect(within(step(4)).queryByRole('button', { name: 'Change a detail' })).toBeNull()
    // Fold step 4: the mark goes back to step 3, still open.
    fireEvent.click(within(step(4)).getByRole('button', { name: 'Fold' }))
    await waitFor(() => expect(within(step(4)).getByRole('button', { name: '4 · Check the details' }).getAttribute('aria-expanded')).toBe('false'))
    expect(document.querySelector('.lienRelease-preview')?.getAttribute('data-look-part')).toBe('amount')
    fireEvent.click(within(step(3)).getByRole('button', { name: 'Fold' }))
    await waitFor(() => expect(document.querySelector('.lienRelease-preview')?.getAttribute('data-look-part')).toBeNull())
    expect(screen.queryAllByTestId('lien-waiver-amount-mark')).toHaveLength(0)
  })

  it('click to look keeps the keyboard on the step: opening lands on Fold, folding lands back on the step', async () => {
    db.releases = [AWAITING]
    await open650()
    await waitFor(() => expect(step(5).textContent).toContain('Waiting for Malachi Whites to sign'))
    const open2 = within(step(2)).getByRole('button', { name: '2 · Check the form' })
    open2.focus()
    fireEvent.click(open2)
    await waitFor(() => expect(document.activeElement?.textContent).toBe('Fold'))
    expect(document.activeElement?.closest('[data-testid="lien-step-2"]')).toBeTruthy()
    fireEvent.click(document.activeElement as HTMLElement)
    await waitFor(() => expect(document.activeElement?.textContent).toBe('2 · Check the form'))
    expect(document.activeElement?.getAttribute('aria-expanded')).toBe('false')
  })

  it('click to look: Cancel request unfolds everything for editing and clears what was opened', async () => {
    db.releases = [AWAITING]
    await open650()
    await waitFor(() => expect(step(5).textContent).toContain('Waiting for Malachi Whites to sign'))
    fireEvent.click(within(step(2)).getByRole('button', { name: '2 · Check the form' }))
    await waitFor(() => expect(within(step(2)).getByRole('button', { name: 'Fold' })).toBeTruthy())
    fireEvent.click(within(step(5)).getByRole('button', { name: 'Cancel request' }))
    await waitFor(() => expect(within(step(2)).queryByRole('button', { name: 'Fold' })).toBeNull())
  })

  it('a draft folds nothing, so there is nothing to open; the numbers still bring a step into view', async () => {
    await open650()
    expect(screen.queryByText('Look ›')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Fold' })).toBeNull()
    fireEvent.click(step(2).querySelector('.lienStep-dot')!)
    expect(document.querySelector('.lienRelease-preview')?.getAttribute('data-look-part')).toBeNull()
  })

  it('the waiver being worked on can still be voided: the footer asks twice, then voids and closes', async () => {
    db.releases = [AWAITING]
    const onClose = vi.fn()
    renderWithProviders(<LienReleaseModal open onClose={onClose} job={job} invoice={bill1} signerNameFallback="Malachi Whites" />)
    await waitFor(() => expect(screen.getByTestId('lien-step-5').textContent).toContain('Waiting for Malachi Whites to sign'))
    fireEvent.click(screen.getByRole('button', { name: 'Void this waiver' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm void' }))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })
})
