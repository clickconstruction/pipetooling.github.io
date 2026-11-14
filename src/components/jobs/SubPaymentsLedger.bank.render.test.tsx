// @vitest-environment jsdom
/**
 * The Subs Ledger's bank match (punch list #347, PR 5): Find bank lines reads the bank, a payment with a line
 * that fits offers it, a press matches, and a matched payment says the line it left on with a way back.
 * The hook that talks to the database is stood in for, so each test sets what the bank holds.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import type { BankLine } from '../../lib/subWorkOrders/subPaymentBankMatch'
import type { SubSendingResult } from '../../types/laborJob'

vi.mock('../../hooks/useIsNarrowScreen', () => ({ useIsNarrowScreen: () => false }))
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

const bankState = {
  matchedByPayment: new Map<string, string>(),
  bankById: new Map<string, BankLine>(),
  bank: null as BankLine[] | null,
  reading: false,
  readBank: vi.fn(async (): Promise<{ ok: true; count: number } | { ok: false; message: string }> => ({ ok: true, count: 0 })),
  match: vi.fn(async (): Promise<SubSendingResult> => ({ ok: true })),
  unmatch: vi.fn(async (): Promise<SubSendingResult> => ({ ok: true })),
  reloadMatches: vi.fn(async () => {}),
}
const enabledWith: boolean[] = []
vi.mock('../../hooks/useSubPaymentBank', () => ({
  useSubPaymentBank: (enabled: boolean) => {
    enabledWith.push(enabled)
    return bankState
  },
}))

import { installDomShims, makeLaborJob, renderWithProviders, settle } from '../../test/renderSmokeMocks'
import { SubPaymentsLedger } from './SubPaymentsLedger'

beforeAll(installDomShims)
afterEach(() => {
  cleanup()
  bankState.matchedByPayment = new Map()
  bankState.bankById = new Map()
  bankState.bank = null
  bankState.reading = false
  vi.clearAllMocks()
  enabledWith.length = 0
})

const line = (id: string, amount: number, ymd: string, payee: string): BankLine => ({ id, amount, ymd, payee, memo: '' })
function sheet() {
  const job = makeLaborJob({ id: 'bank', assigned_to_name: 'Harlow Drywall', job_number: 'S-2300', address: '8 Cedar Ct' })
  job.payments = [
    { id: 'p-a', amount: 20, memo: 'draw', created_at: '2025-11-03T17:00:00Z', payment_date: '2025-11-03', method: 'check', method_ref: '1042' },
    { id: 'p-b', amount: 15, memo: 'second', created_at: '2025-11-05T17:00:00Z', payment_date: '2025-11-05', method: 'zelle' },
    { id: 'p-back', amount: -5, memo: 'damage', created_at: '2025-11-06T18:00:00Z', payment_date: null },
  ]
  return job
}
function mount(over: Record<string, unknown> = {}) {
  const props = {
    error: null,
    laborJobs: [sheet()],
    laborJobsLoading: false,
    laborJobNamesByJobId: {},
    laborJobAssigneesByJobId: new Map(),
    onOpenSheet: vi.fn(),
    onOpenPay: vi.fn(),
    onSetChecked: vi.fn(async (): Promise<SubSendingResult> => ({ ok: true })),
    onBankChanged: vi.fn(),
    ...over,
  }
  renderWithProviders(<SubPaymentsLedger {...(props as unknown as Parameters<typeof SubPaymentsLedger>[0])} />)
  return props
}
const showAll = () => fireEvent.click(screen.getByRole('button', { name: 'All' }))

describe('SubPaymentsLedger · matched to the bank', () => {
  it('a caller that cannot tick gets no bank press, and the bank is not read for it', async () => {
    mount({ onSetChecked: undefined })
    await settle()
    showAll()
    expect(screen.queryByRole('button', { name: 'Find bank lines' })).toBeNull()
    expect(enabledWith.every((e) => e === false)).toBe(true)
  })

  it('Find bank lines reads the bank from just before the earliest payment shown', async () => {
    mount()
    await settle()
    showAll()
    expect(document.querySelector('[data-ledger-match]')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Find bank lines' }))
    // Oct 30: the earliest payment is Nov 3, less the three days either side and one more.
    await waitFor(() => expect(bankState.readBank).toHaveBeenCalledWith('2025-10-30'))
  })

  it('a payment with a bank line that fits offers it, and picking it matches and reads the sheets again', async () => {
    bankState.bank = [line('t-a', 20, '2025-11-04', 'HARLOW DRYWALL LLC'), line('t-other', 99, '2025-11-04', 'Someone')]
    const props = mount()
    await settle()
    showAll()
    expect(document.querySelector('[data-ledger-bank-said]')!.textContent).toBe('2 bank lines read. 1 payment has one to match.')
    const pick = document.querySelector('[data-ledger-match="p-a"]') as HTMLSelectElement
    expect([...pick.options].map((o) => o.textContent)).toEqual(['Match to a bank line…', 'Nov 4, 2025 · HARLOW DRYWALL LLC · $20.00'])
    expect(document.querySelector('[data-ledger-match="p-b"]')).toBeNull()
    expect(document.querySelector('[data-ledger-match="p-back"]')).toBeNull()
    fireEvent.change(pick, { target: { value: 't-a' } })
    await waitFor(() => expect(bankState.match).toHaveBeenCalledWith('p-a', 't-a'))
    await waitFor(() => expect(props.onBankChanged).toHaveBeenCalledTimes(1))
  })

  it('a matched payment says the bank line it left on, and undo takes it off', async () => {
    bankState.matchedByPayment = new Map([['p-a', 't-a']])
    bankState.bankById = new Map([['t-a', line('t-a', 20, '2025-11-04', 'HARLOW DRYWALL LLC')]])
    bankState.bank = [line('t-a', 20, '2025-11-04', 'HARLOW DRYWALL LLC')]
    const props = mount()
    await settle()
    showAll()
    const tag = document.querySelector('[data-ledger-matched="p-a"]')!
    expect(tag.textContent).toContain('bank Nov 4, 2025 · HARLOW DRYWALL LLC')
    // It is matched, so it is offered nothing more.
    expect(document.querySelector('[data-ledger-match="p-a"]')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Take this payment off its bank line' }))
    await waitFor(() => expect(bankState.unmatch).toHaveBeenCalledWith('p-a'))
    await waitFor(() => expect(props.onBankChanged).toHaveBeenCalledTimes(1))
  })

  it('a match the database refuses is said with its reason, and nothing is read again', async () => {
    bankState.bank = [line('t-a', 20, '2025-11-04', 'HARLOW DRYWALL LLC')]
    bankState.match.mockResolvedValueOnce({ ok: false, missing: false, message: 'that bank line is 20.00 and the payments on it would come to 40.00' })
    const props = mount()
    await settle()
    showAll()
    fireEvent.change(document.querySelector('[data-ledger-match="p-a"]') as HTMLSelectElement, { target: { value: 't-a' } })
    expect(await screen.findByText('that bank line is 20.00 and the payments on it would come to 40.00')).toBeTruthy()
    expect(props.onBankChanged).not.toHaveBeenCalled()
  })

  it('a bank that cannot be read says why', async () => {
    bankState.readBank.mockResolvedValueOnce({ ok: false, message: 'The bank lines could not be read.' })
    mount()
    await settle()
    showAll()
    fireEvent.click(screen.getByRole('button', { name: 'Find bank lines' }))
    expect(await screen.findByText('The bank lines could not be read.')).toBeTruthy()
  })

  it('unticking a matched payment reads the matches back, since the tick takes the match with it', async () => {
    bankState.matchedByPayment = new Map([['p-a', 't-a']])
    const job = sheet()
    job.payments![0]!.checked_at = '2025-11-20T18:00:00Z'
    mount({ laborJobs: [job] })
    await settle()
    showAll()
    fireEvent.click(document.querySelector('[data-ledger-check="p-a"]') as HTMLInputElement)
    await waitFor(() => expect(bankState.reloadMatches).toHaveBeenCalledTimes(1))
  })
})
