// @vitest-environment jsdom
/**
 * The paper is the form (the Contract window, PR 2): the agreement laid out as the customer sees
 * it, edited in place — ghost lines for what is empty, editors where the text was, the job's
 * amount with its door, the terms with read and edit, the signature frames; read-only when locked.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import JobContractPaper, { type JobContractPaperProps } from './JobContractPaper'
import { EMPTY_JOB_CONTRACT_FIELDS } from '../../lib/jobs/jobContractDocument'

afterEach(cleanup)

function props(over: Partial<JobContractPaperProps> = {}): JobContractPaperProps {
  return {
    job: { job_address: '1 Test Street, Austin, TX 78701', job_name: 'Water heater', customer_name: 'Sam Sample' },
    jobNumber: '1053',
    issuer: { companyName: 'Click Plumbing and Electrical', addressText: '5501 Balcones Dr', phone: '512-360-0599', email: 'office@clickplumbing.com', tagline: '', licenseLine: 'Malachi Whites · RMP 41130' },
    dateLabel: 'Sep 29, 2026',
    revision: 1,
    editable: true,
    fields: { ...EMPTY_JOB_CONTRACT_FIELDS, scope_lines: ['Rough-in', 'Top-out'], amount_cents: 220000 },
    setField: vi.fn(),
    scopeText: 'Rough-in\nTop-out',
    applyScopeText: vi.fn(),
    recipientName: 'Sam Sample',
    setRecipientName: vi.fn(),
    amount: { src: { source: 'line_items', cents: 220000, lineCount: 3 }, frozenCents: null, drift: null, onOpenJob: vi.fn(), onUseJobAmount: vi.fn() },
    terms: { name: 'Service agreement', clauseCount: 12, versionLabel: 'Sep 29', bodyHtml: '1. Scope. Contractor will do the work.\n\n2. Changes.', bodyFormat: 'plain', open: false, onToggle: vi.fn(), onEdit: vi.fn(), builtInNote: null },
    signature: null,
    ...over,
  }
}

describe('JobContractPaper', () => {
  it('lays the agreement out as the customer sees it, with ghost lines for what is empty and the frames to sign', () => {
    render(<JobContractPaper {...props()} />)
    const paper = screen.getByTestId('contract-paper')
    expect(paper.textContent).toContain('Service agreement for 1 Test Street')
    expect(paper.textContent).toContain('Job #1053')
    expect(within(paper).getByTestId('paper-name').textContent).toBe('Sam Sample')
    expect(within(paper).getByTestId('paper-scope').textContent).toContain('Rough-in')
    expect(within(paper).getByTestId('paper-exclusions').textContent).toContain('+ not included')
    expect(within(paper).getByTestId('paper-dates').textContent).toContain('+ start and estimated completion')
    expect(within(paper).getByTestId('paper-note').textContent).toContain('+ a line the customer reads')
    expect(within(paper).getByTestId('contract-amount-value').textContent).toBe('$2,200.00')
    expect(within(paper).getByTestId('contract-amount-door').textContent).toBe('Adjust line items ›')
    expect(within(paper).getByTestId('contract-terms-row').textContent).toContain('Terms · Service agreement')
    expect(within(paper).getByTestId('contract-terms-row').textContent).toContain('12 clauses · updated Sep 29')
    expect(within(paper).getByTestId('paper-signature').textContent).toContain('Sam Sample signs here')
    expect(within(paper).getByTestId('paper-signature').textContent).toContain('Malachi Whites · RMP 41130')
  })

  it('edits in place: the scope opens a textarea where the list was, a ghost line opens its field, the payment line opens the chips', () => {
    const p = props()
    render(<JobContractPaper {...p} />)
    fireEvent.click(screen.getByTestId('paper-scope'))
    const ta = screen.getByTestId('paper-scope-textarea') as HTMLTextAreaElement
    expect(ta.value).toBe('Rough-in\nTop-out')
    fireEvent.change(ta, { target: { value: 'Rough-in\nTop-out\nFinish' } })
    expect(p.applyScopeText).toHaveBeenCalledWith('Rough-in\nTop-out\nFinish')
    fireEvent.blur(ta)
    expect(screen.queryByTestId('paper-scope-textarea')).toBeNull()

    fireEvent.click(screen.getByTestId('paper-exclusions'))
    fireEvent.change(screen.getByLabelText('Not included'), { target: { value: 'Drywall' } })
    expect(p.setField).toHaveBeenCalledWith('exclusions', 'Drywall')

    fireEvent.click(screen.getByTestId('paper-payment'))
    const chips = screen.getByTestId('paper-payment-chips')
    fireEvent.click(within(chips).getByRole('button', { name: 'Due on completion' }))
    expect(p.setField).toHaveBeenCalledWith('payment_terms_key', 'on_completion')
    fireEvent.click(within(chips).getByRole('button', { name: 'Done' }))
    expect(screen.queryByTestId('paper-payment-chips')).toBeNull()

    fireEvent.click(screen.getByTestId('paper-name'))
    fireEvent.change(screen.getByTestId('paper-name-editor'), { target: { value: 'Sam and Pat Sample' } })
    expect(p.setRecipientName).toHaveBeenCalledWith('Sam and Pat Sample')
  })

  it('the terms read all and edit doors, the drift line, and the built-in note', () => {
    const p = props({ amount: { src: { source: 'line_items', cents: 220000, lineCount: 3 }, frozenCents: null, drift: { draftCents: 180000 }, onOpenJob: vi.fn(), onUseJobAmount: vi.fn() }, terms: { ...props().terms, onEdit: null, builtInNote: 'The built-in wording, until the office adds a customer document to the Contract Book.' } })
    render(<JobContractPaper {...p} />)
    fireEvent.click(screen.getByTestId('contract-terms-read'))
    expect(p.terms.onToggle).toHaveBeenCalled()
    expect(screen.queryByTestId('contract-terms-edit')).toBeNull()
    expect(screen.getByText(/The built-in wording, until the office adds/)).toBeTruthy()
    expect(screen.getByTestId('contract-amount-drift').textContent).toContain('This draft still says $1,800.00')
    fireEvent.click(screen.getByTestId('contract-amount-use-job'))
    expect(p.amount.onUseJobAmount).toHaveBeenCalled()
  })

  it('locked: no ghost lines, no editors, the frozen amount, and the signature when there is one', () => {
    render(<JobContractPaper {...props({ editable: false, amount: { src: { source: 'none', cents: null }, frozenCents: 314000, drift: null, onOpenJob: null, onUseJobAmount: vi.fn() }, signature: { printedName: 'Sam Sample', auditLine: 'Signed electronically · Sep 14' } })} />)
    const paper = screen.getByTestId('contract-paper')
    expect(paper.textContent).not.toContain('+ not included')
    expect(within(paper).queryByTestId('paper-name')).toBeNull()
    expect(within(paper).getByTestId('contract-amount-value').textContent).toBe('$3,140.00')
    fireEvent.click(within(paper).getByTestId('paper-scope'))
    expect(within(paper).queryByTestId('paper-scope-textarea')).toBeNull()
    expect(within(paper).getByTestId('paper-signature').textContent).toContain('✍ Sam Sample')
  })
})
