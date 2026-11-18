// @vitest-environment jsdom
/**
 * A receipt photo that does not go up (v2.7635): the reason stays under the press, Try again sends the same shot where
 * a second try can get past the failure, and a refusal shows its reason with no second try.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { AddFileFailure } from '../../lib/jobs/addFileFailure'
import LienReceiptPhotoPress from './LienReceiptPhotoPress'

vi.mock('../../lib/materials/photoShrink', () => ({
  shrinkPhoto: async (file: File) => ({ blob: file, shrunk: false }),
}))
vi.mock('../../lib/jobs/jobFolderAddFileIo', () => ({ putJobFolderFile: vi.fn() }))
vi.mock('../../lib/jobs/lienReceiptReadIo', () => ({ readTrackingFromPhoto: async () => '' }))

afterEach(cleanup)

const shot = () => new File([new Uint8Array([1, 2, 3])], 'IMG_0001.jpg', { type: 'image/jpeg' })
const pick = (file: File) => fireEvent.change(document.querySelector('input[type="file"]') as HTMLInputElement, { target: { files: [file] } })

describe('LienReceiptPhotoPress · a photo that did not go up (v2.7635)', () => {
  it('keeps the reason under the press and sends the same shot again on Try again', async () => {
    const onSaved = vi.fn()
    const put = vi
      .fn()
      .mockRejectedValueOnce(new AddFileFailure('The app could not reach Drive.', true))
      .mockResolvedValueOnce({ driveFileId: 'f1', url: 'https://drive.google.com/file/d/f1/view' })
    renderWithProviders(<LienReceiptPhotoPress jobId="job-1" jobNumber="77" of="owner" day="2026-11-17" url="" onSaved={onSaved} put={put} />)
    const file = shot()
    pick(file)
    const failed = await waitFor(() => {
      const el = document.querySelector('[data-lien-receipt-failed]')
      expect(el).not.toBeNull()
      return el as HTMLElement
    })
    expect(failed.getAttribute('role')).toBe('alert')
    expect(failed.textContent).toContain('The app could not reach Drive.')
    expect(onSaved).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith('https://drive.google.com/file/d/f1/view'))
    expect(put).toHaveBeenCalledTimes(2)
    // The same shot went both times, under the name the folder keeps.
    const names = put.mock.calls.map((c) => (c[2] as File).name)
    expect(names[0]).toBe(names[1])
    expect(names[1]).toBe('Lien affidavit, Job 77, mail receipt, owner, 2026-11-17.jpg')
    expect(document.querySelector('[data-lien-receipt-failed]')).toBeNull()
  })

  it('shows a refusal with its reason and no Try again', async () => {
    const put = vi.fn().mockRejectedValueOnce(new AddFileFailure('Drive did not take the file. Drive said: quota exceeded.', false))
    renderWithProviders(<LienReceiptPhotoPress jobId="job-1" jobNumber="77" of="owner" day="2026-11-17" url="" onSaved={() => {}} put={put} />)
    pick(shot())
    await waitFor(() => expect(document.querySelector('[data-lien-receipt-failed]')?.textContent).toContain('Drive said: quota exceeded.'))
    expect(document.querySelector('[data-lien-receipt-retry]')).toBeNull()
  })
})

describe('LienReceiptPhotoPress · a receipt is a photo or a PDF', () => {
  it('sends a PDF as it is under the receipt’s name, and says a PDF is not read for its number', async () => {
    const onSaved = vi.fn()
    const onRead = vi.fn()
    const put = vi.fn().mockResolvedValueOnce({ driveFileId: 'f2', url: 'https://drive.google.com/file/d/f2/view' })
    renderWithProviders(<LienReceiptPhotoPress jobId="job-1" jobNumber="77" of="original_contractor" paper="notice" day="2026-11-17" url="" compact onSaved={onSaved} onRead={onRead} put={put} />)
    expect((document.querySelector('input[type="file"]') as HTMLInputElement).accept).toBe('application/pdf,image/*')
    expect(screen.getByRole('button', { name: 'Add the receipt' })).toBeTruthy()
    pick(new File([new Uint8Array([1, 2, 3])], 'SCAN0007.PDF', { type: '' }))
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith('https://drive.google.com/file/d/f2/view'))
    const sent = put.mock.calls[0]![2] as File
    expect(sent.name).toBe('Lien notice, Job 77, mail receipt, original contractor, 2026-11-17.pdf')
    expect(sent.type).toBe('application/pdf')
    expect(onRead).not.toHaveBeenCalled()
    expect(document.querySelector('[data-lien-receipt-read]')?.textContent).toBe('A PDF is not read for its number. Type the number in the box.')
  })

  it('refuses a file that is not a receipt, and nothing goes up', async () => {
    const put = vi.fn()
    renderWithProviders(<LienReceiptPhotoPress jobId="job-1" jobNumber="77" of="owner" day="2026-11-17" url="" compact onSaved={() => {}} put={put} />)
    pick(new File(['a,b'], 'numbers.csv', { type: 'text/csv' }))
    await waitFor(() => expect(document.querySelector('[data-lien-receipt-failed]')?.textContent).toContain('That file is not a receipt. Add a photo or a PDF.'))
    expect(put).not.toHaveBeenCalled()
  })

  it('shows a saved receipt with Open, Replace and Take off, and asks before it takes one off', () => {
    const onTakeOff = vi.fn()
    renderWithProviders(<LienReceiptPhotoPress jobId="job-1" jobNumber="77" of="owner" day="2026-11-17" url="https://drive.google.com/file/d/f1/view" compact onSaved={() => {}} onTakeOff={onTakeOff} />)
    expect(document.querySelector('[data-lien-receipt-saved]')?.textContent).toBe('✓ Receipt saved')
    expect((screen.getByRole('link', { name: 'Open the receipt' }) as HTMLAnchorElement).href).toBe('https://drive.google.com/file/d/f1/view')
    expect(screen.getByRole('button', { name: 'Replace' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Take off' }))
    expect(screen.getByText('Take this receipt off? The file stays in the job’s Drive folder.')).toBeTruthy()
    expect(onTakeOff).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Keep it' }))
    expect(document.querySelector('[data-lien-receipt-ask]')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Take off' }))
    fireEvent.click(screen.getByRole('button', { name: 'Take it off' }))
    expect(onTakeOff).toHaveBeenCalledTimes(1)
  })

  it('on a phone opens a sheet with the camera and the picker', () => {
    renderWithProviders(<LienReceiptPhotoPress jobId="job-1" jobNumber="77" of="owner" day="2026-11-17" url="" onSaved={() => {}} />)
    expect(document.querySelector('[data-lien-receipt-sheet]')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Add the receipt' }))
    const sheet = document.querySelector('[data-lien-receipt-sheet]') as HTMLElement
    expect(sheet.textContent).toContain('Take a photo')
    expect(sheet.textContent).toContain('Choose a photo or a PDF')
    const inputs = [...document.querySelectorAll('input[type="file"]')] as HTMLInputElement[]
    expect(inputs.map((i) => [i.accept, i.getAttribute('capture')])).toEqual([
      ['application/pdf,image/*', null],
      ['image/*', 'environment'],
    ])
  })

  it('leaves the clerk’s stamped page a photo', () => {
    renderWithProviders(<LienReceiptPhotoPress jobId="job-1" jobNumber="77" of="clerk" day="2026-11-17" url="" compact onSaved={() => {}} />)
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    expect([input.accept, input.getAttribute('capture')]).toEqual(['image/*', 'environment'])
    expect(screen.getByRole('button', { name: 'Take a photo of the stamped page' })).toBeTruthy()
  })
})
