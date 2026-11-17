// @vitest-environment jsdom
/**
 * Add the stamped scans (punch list #366): several filed liens' scans picked at once, each matched to its lien by
 * its name or its place, checked by the office, and saved one file a lien to that lien's own job.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import type { LienScanTarget } from '../../lib/jobs/lienScanBatch'
import type { LienScanSave } from '../../lib/jobs/lienScanBatchIo'
import LienScanBatchWindow from './LienScanBatchWindow'

afterEach(() => cleanup())

// Every name and number here is made up.
const target = (jobNumber: string, recordingNumber: string, over: Partial<LienScanTarget> = {}): LienScanTarget => ({ filingId: `f-${jobNumber}`, jobId: `job-${jobNumber}`, jobNumber, jobLabel: `${jobNumber} · Sample Job`, recordingNumber, filedYmd: '2026-11-13', county: 'Hays', hasScan: false, ...over })
const TARGETS = [target('2104', '2026-0041870'), target('2291', '2026-0041877'), target('2317', '2026-0041881'), target('1988', '2026-0030001', { hasScan: true })]
const pdf = (name: string, bytes = 2048, type = 'application/pdf') => new File([new Uint8Array(bytes)], name, { type })

function open(over: Partial<Parameters<typeof LienScanBatchWindow>[0]> = {}) {
  const props = { targets: TARGETS, onChanged: vi.fn(), onClose: vi.fn(), save: vi.fn(async (saves: ReadonlyArray<LienScanSave>) => ({ done: [...saves], failed: [] })), ...over }
  renderWithProviders(<LienScanBatchWindow {...props} />)
  return props
}
const pick = (...files: File[]) => fireEvent.change(screen.getByLabelText('Choose the scans'), { target: { files } })
const row = (name: string) => within(document.querySelector(`[data-lien-scan-piece="${name}"]`) as HTMLElement)
const lienOf = (name: string) => (row(name).getByRole('combobox') as HTMLSelectElement).value
const saveBtn = () => document.querySelector('[data-lien-scan-save]') as HTMLButtonElement

describe('LienScanBatchWindow', () => {
  it('lists the filed liens with no scan, and has nothing to save until a file is picked', () => {
    open()
    expect(screen.getByText('3 filed liens have no scan yet.')).toBeTruthy()
    const without = within(document.querySelector('[data-lien-scan-without]') as HTMLElement)
    expect(without.getByText('2104 · Sample Job · no. 2026-0041870')).toBeTruthy()
    // A lien that has its scan is not offered until asked for.
    expect(without.queryByText(/1988/)).toBeNull()
    expect(saveBtn().disabled).toBe(true)
    expect(saveBtn().textContent).toBe('Save')
  })

  it('matches each file by its name or its place, says which, and saves one file a lien', async () => {
    const props = open()
    pick(pdf('2026-0041877.pdf'), pdf('Job 2104 stamped.pdf'), pdf('SCAN0003.pdf'))
    expect(lienOf('2026-0041877.pdf')).toBe('f-2291')
    expect(row('2026-0041877.pdf').getByText('Its name has this lien’s recording number.')).toBeTruthy()
    expect(lienOf('Job 2104 stamped.pdf')).toBe('f-2104')
    expect(row('Job 2104 stamped.pdf').getByText('Its name has this job’s number.')).toBeTruthy()
    expect(lienOf('SCAN0003.pdf')).toBe('f-2317')
    expect(row('SCAN0003.pdf').getByText('Matched by its place in the list. Check it against the stamp.')).toBeTruthy()
    expect(screen.getByText('Check each one against the clerk’s stamp before you save.')).toBeTruthy()
    expect(saveBtn().textContent).toBe('Save 3 scans')
    fireEvent.click(saveBtn())
    await waitFor(() => expect(props.onClose).toHaveBeenCalledTimes(1))
    const saves = (props.save as ReturnType<typeof vi.fn>).mock.calls[0]![0] as LienScanSave[]
    expect(saves.map((s) => [s.file.name, s.target.jobId, s.target.filingId])).toEqual([
      ['2026-0041877.pdf', 'job-2291', 'f-2291'],
      ['Job 2104 stamped.pdf', 'job-2104', 'f-2104'],
      ['SCAN0003.pdf', 'job-2317', 'f-2317'],
    ])
    expect(props.onChanged).toHaveBeenCalledTimes(1)
  })

  it('holds a second file for one lien and a file with no lien, saves the rest, and keeps what is held', async () => {
    const props = open()
    pick(pdf('a.pdf'), pdf('b.pdf'))
    // Both sent to one lien by hand: the second is held.
    fireEvent.change(row('b.pdf').getByRole('combobox'), { target: { value: 'f-2104' } })
    expect(row('b.pdf').getByText('2104 · Sample Job already has a scan above. A lien keeps one.')).toBeTruthy()
    expect(saveBtn().textContent).toBe('Save 1 scan · 1 held ▸')
    expect(screen.getByText('1 is held. It stays here with the reason. The 1 ready one saves now.')).toBeTruthy()
    fireEvent.click(saveBtn())
    await waitFor(() => expect(props.onChanged).toHaveBeenCalledTimes(1))
    // The held file is still there, and the window with it.
    expect(document.querySelector('[data-lien-scan-piece="b.pdf"]')).toBeTruthy()
    expect(document.querySelector('[data-lien-scan-piece="a.pdf"]')).toBeNull()
    expect(props.onClose).not.toHaveBeenCalled()
    fireEvent.change(row('b.pdf').getByRole('combobox'), { target: { value: '' } })
    expect(row('b.pdf').getByText('No lien is picked for it.')).toBeTruthy()
    expect(saveBtn().disabled).toBe(true)
  })

  it('refuses a file the folder cannot take, with what to do', () => {
    open()
    pick(pdf('stack.pdf', 11 * 1024 * 1024), pdf('notes.txt', 100, 'text/plain'))
    expect(row('stack.pdf').getByText('That file is 11 MB. The most a file can be is 10 MB. Scan this affidavit alone, or at a lower quality.')).toBeTruthy()
    expect(row('notes.txt').getByText('That file is not a scan or a photo. Add a PDF or a picture.')).toBeTruthy()
    expect(saveBtn().disabled).toBe(true)
  })

  it('keeps a scan that did not save in the window with its reason', async () => {
    const save = vi.fn(async (saves: ReadonlyArray<LienScanSave>) => ({ done: [], failed: saves.map((s) => ({ save: s, reason: 'the file was not added to the job’s folder' })) }))
    const props = open({ save })
    pick(pdf('a.pdf'))
    fireEvent.click(saveBtn())
    await waitFor(() => expect(row('a.pdf').getByText('Not saved: the file was not added to the job’s folder')).toBeTruthy())
    expect(props.onChanged).not.toHaveBeenCalled()
    expect(props.onClose).not.toHaveBeenCalled()
  })

  it('offers a lien that already has a scan only when asked', () => {
    open()
    pick(pdf('a.pdf'))
    const options = () => Array.from(row('a.pdf').getByRole('combobox').querySelectorAll('option')).map((o) => o.textContent)
    expect(options()).not.toContain('1988 · Sample Job · no. 2026-0030001')
    fireEvent.click(screen.getByRole('checkbox', { name: 'Also list liens that already have a scan' }))
    expect(options()).toContain('1988 · Sample Job · no. 2026-0030001')
  })

  it('a file added later takes a lien nobody has, and a file can be removed', () => {
    open()
    pick(pdf('first.pdf'))
    expect(lienOf('first.pdf')).toBe('f-2104')
    pick(pdf('second.pdf'))
    expect(lienOf('second.pdf')).toBe('f-2291')
    fireEvent.click(screen.getByRole('button', { name: 'Remove first.pdf' }))
    expect(document.querySelector('[data-lien-scan-piece="first.pdf"]')).toBeNull()
    expect(saveBtn().textContent).toBe('Save 1 scan')
  })
})
