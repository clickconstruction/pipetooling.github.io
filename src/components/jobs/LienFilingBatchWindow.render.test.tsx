// @vitest-environment jsdom
/**
 * Back from the clerk (v2.7856): the liens in Ready to file in one window, each recorded as filed as its document
 * number is typed, with the clerk's files sent to their liens by the job number in their names.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import type { LienFilingTarget } from '../../lib/jobs/lienFilingBatch'
import LienFilingBatchWindow from './LienFilingBatchWindow'

afterEach(() => {
  cleanup()
  window.localStorage.clear()
})

// Every job, county and number here is made up.
const target = (n: string, over: Partial<LienFilingTarget> = {}): LienFilingTarget => ({ jobId: `job-${n}`, jobNumber: `JP${n}`, jobLabel: `${n} · Sample Job`, county: 'Alder', fileByYmd: '2026-12-15', daysLeft: 27, fields: { county: 'Alder', unpaidAmount: '9000.00' }, amount: 9000, ...over })
const TARGETS = [target('9004'), target('9007'), target('9011', { county: 'Birch' })]
const KNOWN = [
  { filingId: 'a', county: 'Alder', number: '20260229001', filedYmd: '2026-11-16', jobLabel: '9001 · Sample Job' },
  { filingId: 'b', county: 'Alder', number: '20260229002', filedYmd: '2026-11-16', jobLabel: '9002 · Sample Job' },
]

function open(over: Partial<Parameters<typeof LienFilingBatchWindow>[0]> = {}) {
  const props = {
    targets: TARGETS,
    known: KNOWN,
    todayYmd: '2026-11-18',
    authUserId: 'user-1',
    onChanged: vi.fn(),
    onClose: vi.fn(),
    onOpenLien: vi.fn(),
    onMailCopies: vi.fn(),
    record: vi.fn(async (args: { target: LienFilingTarget; file?: File | null }) => ({ filingId: `filing-${args.target.jobId}`, scanProblem: '', scanSaved: Boolean(args.file) })),
    saveScan: vi.fn(async () => ''),
    takeBack: vi.fn(async () => 'approved' as const),
    ...over,
  }
  renderWithProviders(<LienFilingBatchWindow {...(props as unknown as Parameters<typeof LienFilingBatchWindow>[0])} />)
  return props as typeof props & { record: ReturnType<typeof vi.fn>; saveScan: ReturnType<typeof vi.fn>; takeBack: ReturnType<typeof vi.fn> }
}
const numberBox = (n: string) => screen.getByRole('textbox', { name: `Job JP${n}, document number` }) as HTMLInputElement
const row = (n: string) => document.querySelector(`[data-lien-filing-row="JP${n}"]`) as HTMLElement
const pdf = (name: string) => new File(['%PDF-made-up'], name, { type: 'application/pdf' })

describe('LienFilingBatchWindow', () => {
  it('lists each lien in Ready to file with its county clerk and its day, and says how many wait', () => {
    open()
    expect(screen.getByRole('dialog', { name: 'Back from the clerk: record the filings' })).toBeTruthy()
    expect(document.querySelector('[data-lien-filing-lead]')?.textContent).toBe('3 liens are approved and not yet on record as filed.')
    expect(within(row('9011')).getByText('Birch County Clerk')).toBeTruthy()
    expect(within(row('9004')).getByText('file by Dec 15')).toBeTruthy()
    expect(numberBox('9004').placeholder).toBe('the number on the clerk’s stamp')
    // No press stands at the foot until a file's name brings a number.
    expect(document.querySelector('[data-lien-filing-record-waiting]')).toBeNull()
  })

  it('records a lien the moment Enter is pressed on its number, and moves to the next lien', async () => {
    const props = open()
    fireEvent.change(screen.getByLabelText('Filed on'), { target: { value: '2026-11-17' } })
    fireEvent.change(numberBox('9004'), { target: { value: ' 20260229004 ' } })
    fireEvent.keyDown(numberBox('9004'), { key: 'Enter' })
    await waitFor(() => expect(props.record).toHaveBeenCalledWith({ target: TARGETS[0], number: '20260229004', filedYmd: '2026-11-17', createdBy: 'user-1', file: null }))
    await waitFor(() => expect(row('9004').getAttribute('data-lien-filing-recorded')).toBe('yes'))
    expect(row('9004').querySelector('[data-lien-filing-said="ok"]')?.textContent?.trim()).toMatch(/^Filed Nov 17\. Recorded\. Mail its copies by Nov \d+\.$/)
    expect(row('9004').querySelector('[data-lien-filing-number]')?.textContent).toBe('Document no. 20260229004')
    await waitFor(() => expect(document.activeElement).toBe(numberBox('9007')))
    expect(document.querySelector('[data-lien-filing-lead]')?.textContent).toBe('2 liens are approved and not yet on record as filed.')
    // The desk reads again once, on the way out.
    expect(props.onChanged).not.toHaveBeenCalled()
    fireEvent.click(document.querySelector('[data-lien-filing-close]') as HTMLButtonElement)
    expect(props.onChanged).toHaveBeenCalledTimes(1)
    expect(props.onClose).toHaveBeenCalledTimes(1)
  })

  it('records a typed number when its box is left, once', async () => {
    const props = open()
    fireEvent.change(numberBox('9007'), { target: { value: '20260229007' } })
    fireEvent.blur(numberBox('9007'))
    await waitFor(() => expect(row('9007').getAttribute('data-lien-filing-recorded')).toBe('yes'))
    expect(props.record).toHaveBeenCalledTimes(1)
  })

  it('holds a number a lien on record holds, and one typed on another line of this stack', async () => {
    const props = open()
    fireEvent.change(numberBox('9004'), { target: { value: '20260229002' } })
    fireEvent.keyDown(numberBox('9004'), { key: 'Enter' })
    await waitFor(() => expect(row('9004').querySelector('[data-lien-filing-said="bad"]')?.textContent?.trim()).toBe('9002 · Sample Job holds this number too. Two liens cannot share one. Check both stamps.'))
    expect(props.record).not.toHaveBeenCalled()
    fireEvent.change(numberBox('9004'), { target: { value: '20260229004' } })
    fireEvent.keyDown(numberBox('9004'), { key: 'Enter' })
    await waitFor(() => expect(props.record).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(row('9004').getAttribute('data-lien-filing-recorded')).toBe('yes'))
    fireEvent.change(numberBox('9007'), { target: { value: '20260229004' } })
    fireEvent.keyDown(numberBox('9007'), { key: 'Enter' })
    await waitFor(() => expect(row('9007').querySelector('[data-lien-filing-said="bad"]')?.textContent?.trim()).toBe('9004 · Sample Job holds this number too. Two liens cannot share one. Check both stamps.'))
    expect(props.record).toHaveBeenCalledTimes(1)
  })

  it('asks about a number that is not the county’s shape, and records it on the reader’s word', async () => {
    const props = open()
    fireEvent.change(numberBox('9004'), { target: { value: '2026022900' } })
    fireEvent.keyDown(numberBox('9004'), { key: 'Enter' })
    const said = await waitFor(() => row('9004').querySelector('[data-lien-filing-said="warn"]') as HTMLElement)
    expect(said.textContent).toContain('Alder County’s numbers on record have 11 digits and start with the year filed. This one has 10 digits. Check it against the stamp.')
    expect(props.record).not.toHaveBeenCalled()
    fireEvent.click(within(said).getByRole('button', { name: 'Record it anyway' }))
    await waitFor(() => expect(props.record).toHaveBeenCalledTimes(1))
  })

  it('refuses in words with no day, and says why a recording did not land with the number still in its box', async () => {
    const record = vi.fn(async () => {
      throw { message: 'permission denied for table job_lien_filings' }
    })
    open({ record: record as never })
    fireEvent.change(screen.getByLabelText('Filed on'), { target: { value: '' } })
    fireEvent.change(numberBox('9004'), { target: { value: '20260229004' } })
    fireEvent.keyDown(numberBox('9004'), { key: 'Enter' })
    await waitFor(() => expect(row('9004').querySelector('[data-lien-filing-said="bad"]')?.textContent?.trim()).toBe('Set the day the liens were filed.'))
    expect(record).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText('Filed on'), { target: { value: '2026-11-18' } })
    fireEvent.keyDown(numberBox('9004'), { key: 'Enter' })
    await waitFor(() => expect(row('9004').querySelector('[data-lien-filing-said="bad"]')?.textContent?.trim()).toBe('Not recorded: permission denied for table job_lien_filings. The box still holds the number.'))
    expect(numberBox('9004').value).toBe('20260229004')
    expect(row('9004').getAttribute('data-lien-filing-recorded')).toBe('no')
  })

  it('sends the clerk’s files to their liens by the job number in each name, types in the number from the name, and waits for a look', async () => {
    const props = open()
    fireEvent.change(screen.getByLabelText('Choose the stamped liens'), { target: { files: [pdf('J9004 Lien (20260229004).pdf'), pdf('J9007 Lien (20260229007).pdf'), pdf('scan 12.pdf')] } })
    expect(numberBox('9004').value).toBe('20260229004')
    expect(numberBox('9007').value).toBe('20260229007')
    expect(numberBox('9011').value).toBe('')
    expect(within(row('9004')).getByText('The number is from the file’s name. Check it against the stamp.')).toBeTruthy()
    const chooser = document.querySelector('[data-lien-filing-chooser]') as HTMLElement
    expect(chooser.textContent).toContain('2 files went to their liens, by the job number in each name.')
    expect(chooser.querySelector('[data-lien-filing-file-left]')?.textContent).toBe('scan 12.pdf: left out, its name holds no job number of a lien here.')
    // A number that came from a name is not recorded by leaving its box.
    fireEvent.blur(numberBox('9004'))
    expect(props.record).not.toHaveBeenCalled()
    // One counted press records every number that waits, each with its file.
    const press = document.querySelector('[data-lien-filing-record-waiting]') as HTMLButtonElement
    expect(press.textContent).toBe('Record 2 filings')
    fireEvent.click(press)
    await waitFor(() => expect(props.record).toHaveBeenCalledTimes(2))
    expect((props.record.mock.calls[0]![0] as { file: File }).file.name).toBe('J9004 Lien (20260229004).pdf')
    await waitFor(() => expect(row('9007').querySelector('[data-lien-filing-file="saved"]')?.textContent).toBe('✓ Stamped lien saved'))
    // One lien is left, and the door on to the copies is offered beside it.
    expect(document.querySelector('[data-lien-filing-lead]')?.textContent).toBe('1 lien is approved and not yet on record as filed.')
    fireEvent.click(document.querySelector('[data-lien-filing-mail]') as HTMLButtonElement)
    expect(props.onChanged).toHaveBeenCalledTimes(1)
    expect(props.onMailCopies).toHaveBeenCalledTimes(1)
  })

  it('keeps going past a lien that did not record, and says a stamped file did not save with the lien still on record', async () => {
    const record = vi.fn(async (args: { target: LienFilingTarget }) => {
      if (args.target.jobId === 'job-9004') throw { message: 'the network dropped' }
      return { filingId: 'filing-9007', scanProblem: 'the file was not added to the job’s folder', scanSaved: false }
    })
    open({ record: record as never })
    fireEvent.change(screen.getByLabelText('Choose the stamped liens'), { target: { files: [pdf('J9004 Lien (20260229004).pdf'), pdf('J9007 Lien (20260229007).pdf')] } })
    fireEvent.click(document.querySelector('[data-lien-filing-record-waiting]') as HTMLButtonElement)
    await waitFor(() => expect(record).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(row('9004').querySelector('[data-lien-filing-said="bad"]')?.textContent?.trim()).toBe('Not recorded: the network dropped. The box still holds the number.'))
    await waitFor(() => expect(row('9007').querySelector('[data-lien-filing-said="warn"]')?.textContent).toContain('Its stamped lien did not save: the file was not added to the job’s folder. Add it again.'))
    expect(row('9007').getAttribute('data-lien-filing-recorded')).toBe('yes')
  })

  it('saves a stamped file at once on a lien already on record', async () => {
    const props = open()
    fireEvent.change(numberBox('9004'), { target: { value: '20260229004' } })
    fireEvent.keyDown(numberBox('9004'), { key: 'Enter' })
    await waitFor(() => expect(row('9004').getAttribute('data-lien-filing-recorded')).toBe('yes'))
    fireEvent.change(row('9004').querySelector('input[type="file"]') as HTMLInputElement, { target: { files: [pdf('stamped.pdf')] } })
    await waitFor(() => expect(props.saveScan).toHaveBeenCalledTimes(1))
    expect((props.saveScan.mock.calls[0]![0] as { filingId: string; number: string }).filingId).toBe('filing-job-9004')
    await waitFor(() => expect(row('9004').querySelector('[data-lien-filing-file="saved"]')).not.toBeNull())
  })

  describe('Take it back on a recorded line (v2.7892)', () => {
    const recordOne = async (props: ReturnType<typeof open>) => {
      fireEvent.change(numberBox('9004'), { target: { value: '20260229004' } })
      fireEvent.keyDown(numberBox('9004'), { key: 'Enter' })
      await waitFor(() => expect(row('9004').getAttribute('data-lien-filing-recorded')).toBe('yes'))
      expect(props.record).toHaveBeenCalledTimes(1)
    }

    it('asks first, voids that filing on the second press, and opens the line again for the right number', async () => {
      const props = open()
      await recordOne(props)
      // The first press writes nothing and sends nobody to another window.
      fireEvent.click(within(row('9004')).getByRole('button', { name: 'Take it back' }))
      expect(props.takeBack).not.toHaveBeenCalled()
      expect(props.onOpenLien).not.toHaveBeenCalled()
      expect(row('9004').querySelector('[data-lien-filing-take-back-ask]')?.textContent).toContain('Recorded by mistake? This voids the filing and puts the lien back in Ready to file.')
      fireEvent.click(within(row('9004')).getByRole('button', { name: 'Confirm take back' }))
      await waitFor(() => expect(row('9004').getAttribute('data-lien-filing-recorded')).toBe('no'))
      expect(props.takeBack).toHaveBeenCalledTimes(1)
      expect(props.takeBack).toHaveBeenCalledWith({ id: 'filing-job-9004', kind: 'affidavit' })
      expect(row('9004').querySelector('[data-lien-filing-said="ok"]')?.textContent?.trim()).toBe('Taken back. The filing is voided and the lien is in Ready to file again.')
      // The box is back, empty, and counts as waiting again.
      expect(numberBox('9004').value).toBe('')
      expect(document.querySelector('[data-lien-filing-lead]')?.textContent).toBe('3 liens are approved and not yet on record as filed.')
      // The right number records the lien again, as a second filing.
      fireEvent.change(numberBox('9004'), { target: { value: '20260229014' } })
      fireEvent.keyDown(numberBox('9004'), { key: 'Enter' })
      await waitFor(() => expect(row('9004').getAttribute('data-lien-filing-recorded')).toBe('yes'))
      expect(props.record).toHaveBeenCalledTimes(2)
      expect((props.record.mock.calls[1]![0] as { number: string }).number).toBe('20260229014')
    })

    it('Keep it writes nothing and leaves the lien on record', async () => {
      const props = open()
      await recordOne(props)
      fireEvent.click(within(row('9004')).getByRole('button', { name: 'Take it back' }))
      fireEvent.click(within(row('9004')).getByRole('button', { name: 'Keep it' }))
      expect(props.takeBack).not.toHaveBeenCalled()
      expect(row('9004').getAttribute('data-lien-filing-recorded')).toBe('yes')
      expect(within(row('9004')).getByRole('button', { name: 'Take it back' })).toBeTruthy()
    })

    it('says why a take-back did not land, with the lien still on record', async () => {
      const props = open({ takeBack: vi.fn(async () => { throw { message: 'the network dropped' } }) as never })
      await recordOne(props)
      fireEvent.click(within(row('9004')).getByRole('button', { name: 'Take it back' }))
      fireEvent.click(within(row('9004')).getByRole('button', { name: 'Confirm take back' }))
      await waitFor(() => expect(row('9004').querySelector('[data-lien-filing-said="bad"]')?.textContent?.trim()).toBe('Not taken back: the network dropped. The lien is still on record as filed.'))
      expect(row('9004').getAttribute('data-lien-filing-recorded')).toBe('yes')
    })

    it('warns when the filing is voided and its paper did not move', async () => {
      const props = open({ takeBack: vi.fn(async () => 'still_sent' as const) as never })
      await recordOne(props)
      fireEvent.click(within(row('9004')).getByRole('button', { name: 'Take it back' }))
      fireEvent.click(within(row('9004')).getByRole('button', { name: 'Confirm take back' }))
      await waitFor(() => expect(row('9004').querySelector('[data-lien-filing-said="warn"]')?.textContent?.trim()).toBe('Taken back. The filing is voided. Its paper still reads as filed on the Lien desk. Tell your lead.'))
    })

    it('the desk reads again on the way out even when the only record was taken back', async () => {
      const props = open()
      await recordOne(props)
      fireEvent.click(within(row('9004')).getByRole('button', { name: 'Take it back' }))
      fireEvent.click(within(row('9004')).getByRole('button', { name: 'Confirm take back' }))
      await waitFor(() => expect(row('9004').getAttribute('data-lien-filing-recorded')).toBe('no'))
      fireEvent.click(document.querySelector('[data-lien-filing-close]') as HTMLButtonElement)
      expect(props.onChanged).toHaveBeenCalledTimes(1)
      expect(props.onClose).toHaveBeenCalledTimes(1)
    })
  })

  it('sends a lien the desk cannot draw to its own Lien window, and has a good empty state', () => {
    const props = open({ targets: [target('9009', { fields: null, county: '' })] })
    expect(within(row('9009')).getByText('The desk cannot draw this lien’s paper, so it is recorded in its own Lien window.')).toBeTruthy()
    expect(screen.queryByRole('textbox', { name: 'Job JP9009, document number' })).toBeNull()
    fireEvent.click(within(row('9009')).getByRole('button', { name: 'Open its Lien window ›' }))
    expect(props.onOpenLien).toHaveBeenCalledWith('job-9009')
    cleanup()
    open({ targets: [] })
    expect(document.querySelector('[data-lien-filing-none]')?.textContent).toContain('Nothing waiting on a document number.')
  })
})
