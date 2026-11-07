// @vitest-environment jsdom
/**
 * Render smoke for the Signed statements band under a job on the Evidence tab (punch list #212, PR 4): the statements
 * with their record, worker, period, hours and state; Add to evidence on a signed one not yet on the matter, held with
 * its reason when there is no matter; Show on Evidence on one that is; Ask <name>… per worker who clocked; a gap job
 * saying so and asking no one; a viewer who may not make a statement only reads.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import type { LegalEvidenceJob } from '../../../lib/legal/legalPacket'
import { LegalEvidenceStatementsBand, type LegalEvidenceStatementsActs } from './LegalEvidenceStatementsBand'

// Every name, job and number here is made up.
const job: Pick<LegalEvidenceJob, 'jobId' | 'jobLabel' | 'statements' | 'workers' | 'beforeTheApp'> = {
  jobId: 'job-a',
  jobLabel: '717',
  beforeTheApp: false,
  workers: [
    { userId: 'u-marcus', name: 'Marcus Reyes', sessions: 12 },
    { userId: 'u-lena', name: 'Lena Ortiz', sessions: 3 },
  ],
  statements: [
    { id: 'hs-1', recordId: 'HS-717-0001', workerName: 'Marcus Reyes', state: 'signed', signed: true, periodLabel: 'April 1 – April 30, 2026', hours: 118.5, withPay: true, statedDays: 0, signedOn: '2026-05-02', contractDocumentId: 'doc-1', matterDocumentId: null },
    { id: 'hs-2', recordId: 'HS-717-0002', workerName: 'Lena Ortiz', state: 'signed', signed: true, periodLabel: 'May 1 – May 31, 2026', hours: 40, withPay: false, statedDays: 2, signedOn: '2026-06-02', contractDocumentId: 'doc-2', matterDocumentId: 'ld-2' },
    { id: 'hs-3', recordId: 'HS-717-0003', workerName: 'Lena Ortiz', state: 'sent', signed: false, periodLabel: 'June 1 – June 30, 2026', hours: 8, withPay: true, statedDays: 0, signedOn: null, contractDocumentId: 'doc-3', matterDocumentId: null },
  ],
}
const acts = (): LegalEvidenceStatementsActs & { ask: ReturnType<typeof vi.fn>; addToEvidence: ReturnType<typeof vi.fn>; showOnEvidence: ReturnType<typeof vi.fn> } => ({ busy: null, ask: vi.fn(), addToEvidence: vi.fn(), showOnEvidence: vi.fn() })

describe('the Signed statements band (punch list #212, PR 4)', () => {
  it('lists the statements with their facts and state, offers Add to evidence, Show on Evidence and Ask per worker', () => {
    const a = acts()
    render(<LegalEvidenceStatementsBand job={job} firstRecordedDay="2026-03-12" matter={{ id: 'm1', canEdit: true }} canAsk acts={a} />)
    expect(screen.getByText('2 signed · 1 waiting for a signature')).toBeTruthy()
    const first = document.querySelector('[data-legal-statement="HS-717-0001"]')!
    expect(first.textContent).toContain('Marcus Reyes · April 1 – April 30, 2026 · 118.5 h')
    expect(first.textContent).toContain('Signed')
    expect(document.querySelector('[data-legal-statement="HS-717-0002"]')!.textContent).toContain('2 stated by the worker')
    expect(document.querySelector('[data-legal-statement="HS-717-0003"]')!.textContent).toContain('Waiting for a signature')
    fireEvent.click(screen.getByRole('button', { name: 'Add HS-717-0001 to evidence' }))
    expect(a.addToEvidence).toHaveBeenCalledWith('job-a', 'hs-1')
    fireEvent.click(screen.getByRole('button', { name: 'Show on Evidence ↗' }))
    expect(a.showOnEvidence).toHaveBeenCalledWith('ld-2')
    expect(screen.queryByRole('button', { name: 'Add HS-717-0003 to evidence' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Ask Lena Ortiz for a signed statement' }))
    expect(a.ask).toHaveBeenCalledWith('job-a', 'u-lena')
    expect(screen.getByRole('button', { name: 'Ask Marcus Reyes for a signed statement' }).textContent).toBe('Ask Marcus Reyes…')
  })

  it('with no matter, Add to evidence is dead with its reason; while one is in flight it reads Adding…', () => {
    const a = acts()
    render(<LegalEvidenceStatementsBand job={job} firstRecordedDay="2026-03-12" matter={{ id: null, canEdit: true }} canAsk acts={a} />)
    const press = screen.getByRole('button', { name: 'Add HS-717-0001 to evidence' }) as HTMLButtonElement
    expect(press.disabled).toBe(true)
    expect(press.title).toBe('Make the matter first: save the narrative or send the account to the firm.')
    render(<LegalEvidenceStatementsBand job={{ ...job, jobId: 'job-b' }} firstRecordedDay="2026-03-12" matter={{ id: 'm1', canEdit: true }} canAsk acts={{ ...a, busy: 'hs-1' }} />)
    expect((() => { const all = screen.getAllByRole('button', { name: 'Add HS-717-0001 to evidence' }); return all[all.length - 1]!.textContent })()).toBe('Adding…')
  })

  it('a gap job says so and asks no one; a viewer who may not make a statement only reads', () => {
    const a = acts()
    render(<LegalEvidenceStatementsBand job={{ ...job, statements: [], workers: [], beforeTheApp: true }} firstRecordedDay="2026-03-12" matter={{ id: 'm1', canEdit: true }} canAsk acts={a} />)
    expect(screen.getByText(/Nothing clocked here\. The app recorded nothing before March 12, 2026/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Ask / })).toBeNull()
    const { container } = render(<LegalEvidenceStatementsBand job={job} firstRecordedDay="2026-03-12" matter={{ id: 'm1', canEdit: true }} canAsk={false} acts={null} />)
    expect(container.querySelectorAll('button[aria-label^="Ask "]')).toHaveLength(0)
    expect(container.querySelectorAll('button[aria-label^="Add "]')).toHaveLength(0)
    expect(container.textContent).toContain('HS-717-0001')
  })

  it('a viewer the policy answers nothing reads who can see the statements, not Nothing signed here yet (v2.6633)', () => {
    const { container } = render(<LegalEvidenceStatementsBand job={{ ...job, statements: [] }} firstRecordedDay="2026-03-12" matter={{ id: 'm1', canEdit: true }} canAsk={false} acts={null} />)
    expect(container.textContent).toContain('Only a dev or the controller can read the signed statements here.')
    expect(container.textContent).not.toContain('Nothing signed here yet.')
    const { container: empty } = render(<LegalEvidenceStatementsBand job={{ ...job, jobId: 'job-c', statements: [] }} firstRecordedDay="2026-03-12" matter={{ id: 'm1', canEdit: true }} canAsk acts={acts()} />)
    expect(empty.textContent).toContain('Nothing signed here yet.')
  })
})
