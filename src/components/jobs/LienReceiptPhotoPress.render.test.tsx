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
