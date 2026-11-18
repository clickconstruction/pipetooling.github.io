// @vitest-environment jsdom
/**
 * A receipt photo that does not go up (v2.7635): the reason stays under the press, Try again sends the same shot where
 * a second try can get past the failure, and a refusal shows its reason with no second try.
 *
 * A wrong receipt taken off goes to Drive's trash (v2.7743): only after the record's write lands, with the line that
 * says where the file is, Put it back and Try again, and the same for the file a Replace took the place of.
 */
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { AddFileFailure } from '../../lib/jobs/addFileFailure'
import LienReceiptPhotoPress from './LienReceiptPhotoPress'

vi.mock('../../lib/materials/photoShrink', () => ({
  shrinkPhoto: async (file: File) => ({ blob: file, shrunk: false }),
}))
vi.mock('../../lib/jobs/jobFolderAddFileIo', () => ({ putJobFolderFile: vi.fn() }))
vi.mock('../../lib/jobs/lienReceiptReadIo', () => ({ readTrackingFromPhoto: async () => '' }))
// No test here reaches the function: each hands the press its own `trash` and `untrash`.
vi.mock('../../lib/jobs/jobFolderTrashIo', () => ({ takeFileToTrash: vi.fn(async () => null), untrashJobFolderFile: vi.fn(async () => ({ url: '' })) }))

afterEach(cleanup)

const shot = () => new File([new Uint8Array([1, 2, 3])], 'IMG_0001.jpg', { type: 'image/jpeg' })
const pick = (file: File) => fireEvent.change(document.querySelector('input[type="file"]') as HTMLInputElement, { target: { files: [file] } })

// Made-up Drive links, with ids long enough to be read as a Drive file's.
const OLD = 'https://drive.google.com/file/d/old-receipt-0001/view'
const NEW = 'https://drive.google.com/file/d/new-receipt-0002/view'

/** A form that holds the link, as every caller does: the press's `url` follows what the record took. */
function Host({ start = OLD, write, ...rest }: { start?: string; write?: (url: string) => void | Promise<void> } & Partial<Parameters<typeof LienReceiptPhotoPress>[0]>) {
  const [url, setUrl] = useState(start)
  const set = async (next: string) => {
    await write?.(next)
    setUrl(next)
  }
  return <LienReceiptPhotoPress jobId="job-1" jobNumber="77" of="owner" day="2026-11-17" compact url={url} onSaved={(u) => set(u)} onTakeOff={() => set('')} {...rest} />
}
const offLine = () => document.querySelector('[data-lien-receipt-off]') as HTMLElement | null
const takeItOff = () => {
  fireEvent.click(screen.getByRole('button', { name: 'Take off' }))
  fireEvent.click(screen.getByRole('button', { name: 'Take it off' }))
}

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

  it('shows a saved receipt with Open, Replace and Take off, and asks before it takes one off', async () => {
    const onTakeOff = vi.fn()
    renderWithProviders(<LienReceiptPhotoPress jobId="job-1" jobNumber="77" of="owner" day="2026-11-17" url={OLD} compact onSaved={() => {}} onTakeOff={onTakeOff} />)
    expect(document.querySelector('[data-lien-receipt-saved]')?.textContent).toBe('✓ Receipt saved')
    expect((screen.getByRole('link', { name: 'Open the receipt' }) as HTMLAnchorElement).href).toBe(OLD)
    expect(screen.getByRole('button', { name: 'Replace' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Take off' }))
    expect(screen.getByText('Take this receipt off? The file goes to Drive’s trash. Drive keeps it there 30 days.')).toBeTruthy()
    expect(onTakeOff).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Keep it' }))
    expect(document.querySelector('[data-lien-receipt-ask]')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Take off' }))
    fireEvent.click(screen.getByRole('button', { name: 'Take it off' }))
    expect(onTakeOff).toHaveBeenCalledTimes(1)
    // The file's move is asked after the form forgot the link; let it settle.
    await act(async () => {})
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

describe('LienReceiptPhotoPress · a wrong receipt goes to Drive’s trash (v2.7743)', () => {
  it('waits for the record’s write, then moves the file, says where it is, and Put it back names it again', async () => {
    const calls: string[] = []
    let land: () => void = () => {}
    const write = vi.fn((url: string) => {
      calls.push(`write:${url}`)
      // The take-off's write is held open, so the test can look before it lands.
      return url ? Promise.resolve() : new Promise<void>((done) => (land = done))
    })
    const trash = vi.fn(async (_job: string, id: string | null) => {
      calls.push(`trash:${id}`)
      return { where: 'trash' as const }
    })
    const untrash = vi.fn(async (_job: string, id: string) => {
      calls.push(`untrash:${id}`)
      return { url: OLD }
    })
    renderWithProviders(<Host write={write} trash={trash as never} untrash={untrash as never} />)
    takeItOff()
    await waitFor(() => expect(write).toHaveBeenCalledWith(''))
    // The link is not off the record yet: the function would refuse the file, so nothing is asked of it.
    expect(trash).not.toHaveBeenCalled()
    expect(offLine()).toBeNull()
    land()
    await waitFor(() => expect(offLine()?.textContent).toContain('Taken off. The file is in Drive’s trash.'))
    expect(trash).toHaveBeenCalledWith('job-1', 'old-receipt-0001')
    expect(offLine()!.getAttribute('role')).toBe('status')
    expect(document.querySelector('[data-lien-receipt-trash-again]')).toBeNull()
    expect(screen.getByRole('button', { name: 'Add the receipt' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Put it back' }))
    await waitFor(() => expect((screen.getByRole('link', { name: 'Open the receipt' }) as HTMLAnchorElement).href).toBe(OLD))
    expect(offLine()).toBeNull()
    expect(calls).toEqual(['write:', 'trash:old-receipt-0001', 'untrash:old-receipt-0001', `write:${OLD}`])
  })

  it('shows a refusal with its reason and no Try again, and still offers Put it back without asking Drive', async () => {
    const write = vi.fn()
    const trash = vi.fn(async () => ({ where: 'drive' as const, why: 'A lien record still uses it.', retry: false }))
    const untrash = vi.fn()
    renderWithProviders(<Host write={write} trash={trash as never} untrash={untrash as never} />)
    takeItOff()
    await waitFor(() => expect(offLine()?.textContent).toContain('Taken off. The file stays in Drive. A lien record still uses it.'))
    expect(offLine()!.dataset.lienReceiptOff).toBe('drive')
    expect(document.querySelector('[data-lien-receipt-trash-again]')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Put it back' }))
    await waitFor(() => expect(write).toHaveBeenLastCalledWith(OLD))
    // The file never left the folder, so there is nothing to bring out of the trash.
    expect(untrash).not.toHaveBeenCalled()
    await waitFor(() => expect(offLine()).toBeNull())
  })

  it('offers Try again where a second try can help, and the second try moves the file', async () => {
    const trash = vi
      .fn()
      .mockResolvedValueOnce({ where: 'drive', why: 'The app could not be reached. Check the signal.', retry: true })
      .mockResolvedValueOnce({ where: 'trash' })
    renderWithProviders(<Host trash={trash as never} />)
    takeItOff()
    await waitFor(() => expect(offLine()?.textContent).toContain('The file stays in Drive. The app could not be reached. Check the signal.'))
    fireEvent.click(within(offLine()!).getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(offLine()?.textContent).toContain('Taken off. The file is in Drive’s trash.'))
    expect(trash).toHaveBeenCalledTimes(2)
    expect(document.querySelector('[data-lien-receipt-trash-again]')).toBeNull()
  })

  it('leaves the file where it is when the record did not take the take-off', async () => {
    const trash = vi.fn()
    const write = vi.fn(async () => {
      throw new Error('The network dropped.')
    })
    renderWithProviders(<Host write={write} trash={trash as never} />)
    takeItOff()
    await waitFor(() => expect(write).toHaveBeenCalledWith(''))
    await waitFor(() => expect(document.querySelector('[data-lien-receipt-ask]')).toBeNull())
    expect(trash).not.toHaveBeenCalled()
    expect(offLine()).toBeNull()
    // The record still names it, so the receipt still shows.
    expect((screen.getByRole('link', { name: 'Open the receipt' }) as HTMLAnchorElement).href).toBe(OLD)
  })

  it('Replace sends the old file to the trash once the record names the new one, with no Put it back', async () => {
    const calls: string[] = []
    const write = vi.fn(async (url: string) => {
      calls.push(`write:${url}`)
    })
    const put = vi.fn(async () => {
      calls.push('put')
      return { driveFileId: 'new-receipt-0002', url: NEW }
    })
    const trash = vi.fn(async (_job: string, id: string | null) => {
      calls.push(`trash:${id}`)
      return { where: 'trash' as const }
    })
    renderWithProviders(<Host write={write} put={put as never} trash={trash as never} />)
    pick(shot())
    await waitFor(() => expect(offLine()?.textContent).toBe('The old one went to Drive’s trash.'))
    expect(calls).toEqual(['put', `write:${NEW}`, 'trash:old-receipt-0001'])
    expect((screen.getByRole('link', { name: 'Open the receipt' }) as HTMLAnchorElement).href).toBe(NEW)
    expect(screen.queryByRole('button', { name: 'Put it back' })).toBeNull()
  })

  it('Replace says why the old file stays, and keeps it when the record did not take the new one', async () => {
    const put = vi.fn(async () => ({ driveFileId: 'new-receipt-0002', url: NEW }))
    const trash = vi.fn(async () => ({ where: 'drive' as const, why: 'That file is not in the job’s Sent by us folder, so the app leaves it alone.', retry: false }))
    renderWithProviders(<Host put={put as never} trash={trash as never} />)
    pick(shot())
    await waitFor(() => expect(offLine()?.textContent).toBe('The old one stays in Drive. That file is not in the job’s Sent by us folder, so the app leaves it alone.'))
    cleanup()
    const refused = vi.fn()
    const write = vi.fn(async () => {
      throw new Error('The network dropped.')
    })
    renderWithProviders(<Host write={write} put={put as never} trash={refused as never} />)
    pick(shot())
    await waitFor(() => expect(write).toHaveBeenCalledWith(NEW))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Replace' })).toBeTruthy())
    expect(refused).not.toHaveBeenCalled()
    expect(offLine()).toBeNull()
    // The file went up: the upload is not offered again, which would add a second file.
    expect(document.querySelector('[data-lien-receipt-failed]')).toBeNull()
  })

  it('only forgets a link that is not a Drive file’s: the ask names no file, and nothing is moved', async () => {
    const write = vi.fn()
    const trash = vi.fn()
    renderWithProviders(<Host start="https://example.com/receipts/1.pdf" write={write} trash={trash as never} />)
    fireEvent.click(screen.getByRole('button', { name: 'Take off' }))
    expect(document.querySelector('[data-lien-receipt-ask]')?.textContent).toContain('Take this receipt off?')
    expect(document.querySelector('[data-lien-receipt-ask]')?.textContent).not.toContain('trash')
    fireEvent.click(screen.getByRole('button', { name: 'Take it off' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add the receipt' })).toBeTruthy())
    expect(write).toHaveBeenCalledWith('')
    expect(trash).not.toHaveBeenCalled()
    expect(offLine()).toBeNull()
  })

  it('leaves the clerk’s page alone when a new photo takes its place', async () => {
    const put = vi.fn(async () => ({ driveFileId: 'new-receipt-0002', url: NEW }))
    const trash = vi.fn()
    const onSaved = vi.fn()
    renderWithProviders(<LienReceiptPhotoPress jobId="job-1" jobNumber="77" of="clerk" day="2026-11-17" url={OLD} compact onSaved={onSaved} put={put as never} trash={trash as never} />)
    pick(shot())
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(NEW))
    expect(trash).not.toHaveBeenCalled()
  })
})
