// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { GcCustomerWindow } from './GcCustomerWindow'
import type { ContractSendInput, ContractSendOutcome } from './GcCustomerContractSend'
import { boardStateFromRows, type BoardRows } from '../../lib/gc/boardRows'
import { CLINIC_WORTH_NOW, awardedClinicBoardRows, contractSendRow } from '../../lib/gc/boardTestRows'
import { renderWithProviders } from '../../test/renderSmokeMocks'

/** Oak Street Partners' window: the clinic won, our contract on it in the state the rows give. */
function open(rows: BoardRows = awardedClinicBoardRows(), opts: { send?: boolean; email?: boolean; at?: { tab?: 'about' | 'documents'; doc?: string; send?: boolean } } = { send: true }) {
  const state = boardStateFromRows(rows)
  const sendContract = vi.fn((_projectId: string, _input: ContractSendInput): Promise<ContractSendOutcome> => Promise.resolve({ words: 'On record with its price and file.' }))
  const onOpenProject = vi.fn()
  renderWithProviders(
    <GcCustomerWindow
      state={state}
      customer={state.customers.find((c) => c.id === 'c1')!}
      {...(opts.at ? { at: opts.at } : {})}
      {...(opts.send ? { sendContract } : {})}
      canEmail={opts.email === true}
      onOpenProject={onOpenProject}
      onClose={() => undefined}
    />,
  )
  return { sendContract, onOpenProject, dialog: screen.getByRole('dialog', { name: 'Oak Street Partners' }) }
}
/** The clinic with these sends, each emailed unless `emailed: false` (its sent copy, B6-d-iii-b). */
const sent = (sends: (Parameters<typeof contractSendRow>[0] & { emailed?: boolean })[]): BoardRows => {
  const base = awardedClinicBoardRows()
  const rows = sends.map(({ emailed: _e, ...s }) => contractSendRow(s))
  return {
    ...base,
    boardDates: { p1: { ...base.boardDates.p1!, owner_contract_sent_on: '2026-10-05' } },
    ownerContractSends: rows,
    ownerContractEmails: rows.filter((_r, i) => sends[i]!.emailed !== false).map((r) => ({ source_id: r.id, sent_on: r.sent_on, recipient_name: 'Pat Oak' })),
  }
}
const pdf = () => new File(['%PDF-1.7 the contract'], 'Clinic contract v2.pdf', { type: 'application/pdf' })

describe('GcCustomerWindow', () => {
  it('About lists their jobs, each opening its card', () => {
    const { onOpenProject, dialog } = open()
    const job = dialog.querySelector('[data-gc-customer-job="p1"]') as HTMLElement
    expect(within(job).getByText('Hill Country Clinic')).toBeTruthy()
    expect(within(job).getByText('buying out')).toBeTruthy()
    fireEvent.click(within(job).getByRole('button', { name: 'Open the job' }))
    expect(onOpenProject).toHaveBeenCalledWith('p1')
  })

  it('Documents counts our contract to get, and its row sends it to sign', () => {
    const { dialog } = open()
    fireEvent.click(within(dialog).getByRole('tab', { name: 'Documents · 1 to get' }))
    const row = dialog.querySelector('[data-gc-doc="contract-p1"]') as HTMLElement
    expect(within(row).getByText('not sent yet')).toBeTruthy()
    fireEvent.click(within(row).getByRole('button', { name: 'Send to sign' }))
    expect(within(dialog).getByText('Send our contract to sign in their portal')).toBeTruthy()
  })

  it('opened at the contract with its send: the price today, a PDF needed, then the send with what it went with', async () => {
    const { sendContract, dialog } = open(awardedClinicBoardRows(), { send: true, at: { tab: 'documents', doc: 'contract-p1', send: true } })
    const box = dialog.querySelector('[data-gc-customer-send="contract-p1"]') as HTMLElement
    expect(within(box).getByText('$87,323')).toBeTruthy()
    expect(within(box).getByText('Our number today. Check the file says this price.')).toBeTruthy()
    const press = within(box).getByRole('button', { name: 'Send to sign' }) as HTMLButtonElement
    expect(press.disabled).toBe(true)
    const picker = within(box).getByLabelText('The contract PDF')
    fireEvent.change(picker, { target: { files: [new File(['x'], 'notes.docx', { type: 'application/msword' })] } })
    expect(within(box).getByText('Pick a PDF of the contract.')).toBeTruthy()
    const file = pdf()
    fireEvent.change(picker, { target: { files: [file] } })
    expect(press.disabled).toBe(false)
    fireEvent.click(press)
    await waitFor(() => expect(sendContract).toHaveBeenCalledTimes(1))
    const [projectId, input] = sendContract.mock.calls[0]!
    expect(projectId).toBe('p1')
    expect(input).toMatchObject({ signBy: '2026-10-15', note: '', worth: CLINIC_WORTH_NOW, mode: 'first', total: 87323.4, email: false })
    expect(input.file).toBe(file)
    expect(await within(dialog).findByText('On record with its price and file.')).toBeTruthy()
  })

  it('emails it only when ticked, a box that starts off, showing the email they get with the file attached (B6-d-iii-b)', async () => {
    const { sendContract, dialog } = open(awardedClinicBoardRows(), { send: true, email: true, at: { doc: 'contract-p1', send: true } })
    const box = dialog.querySelector('[data-gc-customer-send="contract-p1"]') as HTMLElement
    const tick = within(box).getByLabelText('Email it to them now, with their portal link') as HTMLInputElement
    expect(tick.checked).toBe(false)
    expect(box.querySelector('[data-gc-contract-email]')).toBeNull()
    fireEvent.click(tick)
    const mail = box.querySelector('[data-gc-contract-email]') as HTMLElement
    expect(within(mail).getByText('Your contract for Hill Country Clinic')).toBeTruthy()
    expect(within(mail).getByText('Thank you for choosing us for Hill Country Clinic. Here is our contract for it: $87,323.')).toBeTruthy()
    expect(within(mail).getByText('Read it and sign it in your portal: their link')).toBeTruthy()
    fireEvent.change(within(box).getByLabelText('The contract PDF'), { target: { files: [pdf()] } })
    expect(within(mail).getByText('Clinic contract v2.pdf')).toBeTruthy()
    fireEvent.click(within(box).getByRole('button', { name: 'Send to sign' }))
    await waitFor(() => expect(sendContract).toHaveBeenCalledTimes(1))
    expect(sendContract.mock.calls[0]![1].email).toBe(true)
  })

  it('a send whose email did not go: the row says so, and Email it now emails that same send, nothing picked anew (B6-d-iii-b)', async () => {
    const { sendContract, dialog } = open(sent([{ emailed: false, note: 'Call me' }]), { send: true, email: true, at: { doc: 'contract-p1' } })
    const row = dialog.querySelector('[data-gc-doc="contract-p1"]') as HTMLElement
    expect(within(row).getByText(/Not emailed yet\.$/)).toBeTruthy()
    fireEvent.click(within(row).getByRole('button', { name: 'Email it now' }))
    const box = dialog.querySelector('[data-gc-customer-send="contract-p1"]') as HTMLElement
    expect(within(box).queryByLabelText('The contract PDF')).toBeNull()
    expect(within(box).queryByRole('group', { name: 'Sign by' })).toBeNull()
    expect(within(box).getByText('Thank you for choosing us for Hill Country Clinic. Here is our contract for it: $87,323.')).toBeTruthy()
    sendContract.mockResolvedValueOnce({ words: 'On record. The email did not go: They have no portal link yet.', notEmailed: 'They have no portal link yet.' })
    fireEvent.click(within(box).getByRole('button', { name: 'Send the email' }))
    await waitFor(() => expect(sendContract).toHaveBeenCalledTimes(1))
    expect(sendContract.mock.calls[0]![1]).toMatchObject({ sendId: 'cs1', email: true, mode: 'first', signBy: '2026-10-12', note: 'Call me', file: { path: 'p1/one.pdf' } })
    expect(await within(dialog.querySelector('[data-gc-doc="contract-p1"]') as HTMLElement).findByText(/Not emailed: They have no portal link yet\.$/)).toBeTruthy()
  })

  it('shows no email box to someone who may not email the customer', () => {
    const { dialog } = open(awardedClinicBoardRows(), { send: true, at: { doc: 'contract-p1', send: true } })
    expect(within(dialog).queryByLabelText('Email it to them now, with their portal link')).toBeNull()
    expect(within(dialog).getByText('No email goes. They read it and sign it when they open their portal.')).toBeTruthy()
  })

  it('a reminder keeps the price and the file it went with, unless another file is picked', async () => {
    const { sendContract, dialog } = open(sent([{ worth: CLINIC_WORTH_NOW }]), { send: true, at: { doc: 'contract-p1', send: true } })
    const box = dialog.querySelector('[data-gc-customer-send="contract-p1"]') as HTMLElement
    expect(within(box).getByText('Remind them to sign our contract')).toBeTruthy()
    expect(within(box).getByText('Clinic contract.pdf, as it went last time')).toBeTruthy()
    fireEvent.click(within(box).getByRole('button', { name: 'Send the reminder' }))
    await waitFor(() => expect(sendContract).toHaveBeenCalledTimes(1))
    expect(sendContract.mock.calls[0]![1].file).toEqual({ path: 'p1/one.pdf', name: 'Clinic contract.pdf', sha256: 'ab'.repeat(32) })
  })

  it('our price moved since it went: Send the new price, with a new file and today’s price', () => {
    const { dialog } = open(sent([{ worth: { ...CLINIC_WORTH_NOW, fee: 6000 } }]), { send: true, at: { doc: 'contract-p1' } })
    const row = dialog.querySelector('[data-gc-doc="contract-p1"]') as HTMLElement
    expect(within(row).getByText('Our price changed after we sent it.')).toBeTruthy()
    fireEvent.click(within(row).getByRole('button', { name: 'Send the new price' }))
    const box = dialog.querySelector('[data-gc-customer-send="contract-p1"]') as HTMLElement
    expect(within(box).getByText('$87,323')).toBeTruthy()
    expect((within(box).getByRole('button', { name: 'Send the new price' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('signed in their portal: who signed, and nothing to send', () => {
    const base = sent([{ signed_on: '2026-10-08', signer_printed_name: 'Pat Oak' }])
    const { dialog } = open({ ...base, boardDates: { p1: { ...base.boardDates.p1!, owner_contract_signed_on: '2026-10-08' } } }, { send: true, at: { doc: 'contract-p1' } })
    const row = dialog.querySelector('[data-gc-doc="contract-p1"]') as HTMLElement
    expect(within(row).getByText('signed Oct 8')).toBeTruthy()
    expect(within(row).getByText('Pat Oak signed it in their portal. Their price stays what they signed.')).toBeTruthy()
    expect(within(row).queryByRole('button')).toBeNull()
  })

  it('reads only for someone who does not send it', () => {
    const { dialog } = open(awardedClinicBoardRows(), { send: false, at: { doc: 'contract-p1', send: true } })
    expect(dialog.querySelector('[data-gc-customer-send]')).toBeNull()
    expect(within(dialog.querySelector('[data-gc-doc="contract-p1"]') as HTMLElement).queryByRole('button')).toBeNull()
  })
})
