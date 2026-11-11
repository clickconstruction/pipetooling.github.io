// @vitest-environment jsdom
/**
 * The bid's Files window (punch list #306, PRs 5 and 7): the photos icon opens it on the photos, read once, with the
 * other four rows under them; a grey link icon opens it on its row with the photos folded away, nothing read for
 * them, and the box for the link open; a pasted link is held until it is one, then saved to its column and the page
 * told; Change starts from the link the bid has and will not save it again; the project folder can be made by the
 * app, and a refusal keeps the box with its reason; Add a set opens the form's plan sets field; a training account
 * is offered no change; one photo opened shows alone and comes back to the rows.
 */
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders, settle, useAuthModuleMock } from '../../test/renderSmokeMocks'
import type { BidFilesIo } from '../../lib/bids/bidFilesIo'
import { bidFileRows, type BidFilesInput } from '../../lib/bids/bidFilesWindow'
import type { BidPhotoRow } from '../../lib/bids/bidPhotoWindow'
import type { BidPhotosRead, BidPhotosWindowIo } from '../../lib/bids/bidPhotosIo'

const auth = vi.hoisted(() => ({ readOnly: false }))
vi.mock('../../hooks/useAuth', () => {
  const made = useAuthModuleMock({ role: 'estimator', profileName: 'Dana Whitfield' })
  return { ...made, useAuth: () => ({ ...made.useAuth(), readOnly: auth.readOnly }) }
})
// The form's plan sets field reads and writes its own table; here it is a stand-in with the one press the window hears.
vi.mock('./BidPlanSetsField', () => ({
  BidPlanSetsField: (props: { bidId: string; plansLink: string; onRobotSetChange: (link: string) => void }) => (
    <div data-testid="plan-sets-field" data-bid={props.bidId} data-plans-link={props.plansLink}>
      <button type="button" onClick={() => props.onRobotSetChange('https://drive.google.com/drive/folders/1Robot')}>
        Robot reads this set
      </button>
    </div>
  ),
}))
vi.mock('../../hooks/useNarrowViewport640', () => ({ useNarrowViewport640: () => false }))
vi.mock('../../lib/photos/reportPhotosIo', () => ({
  loadReportPhotoSize: () => Promise.resolve('medium'),
  jobHasDriveFolder: () => Promise.resolve(true),
}))
const opened = vi.hoisted(() => ({ urls: [] as string[] }))
vi.mock('../../lib/openInExternalBrowser', () => ({ openInExternalBrowser: (url: string) => void opened.urls.push(url) }))

import { BidFilesModal, type BidFilesLinks } from './BidFilesModal'

const bid = { id: '00000000-0000-0000-0000-00000306b005', label: 'b598 Quarry Road Storage Bunker' }

const photo = (over: Partial<BidPhotoRow> = {}): BidPhotoRow => ({
  id: 'p1', name: 'Mechanical room north', by_name: 'Dana Whitfield', by_user_id: 'u1', taken_at: '2026-11-06T18:00:00.000Z', added_at: '2026-11-06T18:01:00.000Z',
  bytes: 310_000, storage_path: null, drive_file_id: 'drive-1', filed_at: '2026-11-06T18:05:00.000Z', fail_why: null, ...over,
})

function makeIo(photos: BidPhotoRow[] = []): BidPhotosWindowIo & { loads: number } {
  const answer: BidPhotosRead = { folder: { kind: 'project', projectName: 'Quarry Road Storage Bunker', projectUrl: 'https://drive.google.com/drive/folders/1Project', photosUrl: null, hold: null }, driveWhy: null, photos, previews: {}, adopted: 0 }
  const io: BidPhotosWindowIo & { loads: number } = {
    loads: 0,
    load: () => {
      io.loads += 1
      return Promise.resolve(answer)
    },
    shots: { send: (input) => Promise.resolve({ storagePath: `${input.jobId}/${input.id}.jpg` }), discard: () => Promise.resolve() },
    add: (writes) => Promise.resolve({ added: writes.length, failed: [], failedIds: [] }),
    thumb: () => Promise.resolve(null),
    full: () => Promise.resolve(null),
  }
  return io
}

const nothing: BidFilesInput = { photoCount: 0, driveLink: null, planSets: [], countLink: null, submissionLink: null }
const full: BidFilesInput = {
  photoCount: 1,
  driveLink: 'https://drive.google.com/drive/folders/1Project',
  planSets: [
    { name: 'Issued for bid', link: 'https://drive.google.com/drive/folders/1Bid', onBid: false },
    { name: 'Addendum 1', link: 'https://drive.google.com/drive/folders/1Add', onBid: false },
    { name: 'Permit set', link: 'https://drive.google.com/drive/folders/1Permit', onBid: false },
  ],
  countLink: 'https://counttooling.com/?t=abc',
  submissionLink: null,
}
const linksOf = (input: BidFilesInput): BidFilesLinks => ({ driveLink: input.driveLink ?? null, countLink: input.countLink ?? null, submissionLink: input.submissionLink ?? null, plansLink: input.planSets[0]?.link ?? null, pricedOnSetId: null })

function makeFilesIo(refuse: string | null = null): BidFilesIo & { saved: unknown[]; plans: string[]; made: string[] } {
  const io: BidFilesIo & { saved: unknown[]; plans: string[]; made: string[] } = {
    saved: [],
    plans: [],
    made: [],
    saveLink: (bidId, kind, value) => {
      if (refuse) return Promise.reject(new Error(refuse))
      io.saved.push({ bidId, kind, value })
      return Promise.resolve()
    },
    savePlansLink: (_bidId, link) => {
      io.plans.push(link)
      return Promise.resolve()
    },
    makeFolder: (bidId) => {
      if (refuse) return Promise.reject(new Error(refuse))
      io.made.push(bidId)
      return Promise.resolve({ projectName: 'b598 Quarry Road Storage Bunker' })
    },
  }
  return io
}

const rowOf = (kind: string) => document.querySelector<HTMLElement>(`[data-bid-file-row="${kind}"]`)!
const boxOf = (kind: string) => document.querySelector<HTMLElement>(`[data-bid-file-edit="${kind}"]`)
const linkInput = (kind: string) => document.querySelector<HTMLInputElement>(`[data-bid-file-link="${kind}"]`)!
const savePress = () => document.querySelector<HTMLButtonElement>('[data-bid-file-save]')!

function open(input: BidFilesInput, startOn: 'photos' | 'folder' | 'plans' | 'count' | 'submission', over: Partial<Parameters<typeof BidFilesModal>[0]> = {}) {
  return renderWithProviders(<BidFilesModal bid={bid} rows={bidFileRows(input)} links={linksOf(input)} startOn={startOn} onClose={() => undefined} onEditBid={() => undefined} io={makeIo()} filesIo={makeFilesIo()} {...over} />)
}

describe('BidFilesModal', () => {
  beforeEach(() => {
    auth.readOnly = false
    opened.urls = []
    let urls = 0
    URL.createObjectURL = () => `blob:test-${++urls}`
    URL.revokeObjectURL = () => undefined
  })

  it('opens on the photos from the photos icon, with the other four rows under them and no box open', async () => {
    const io = makeIo()
    open(nothing, 'photos', { io })
    await settle()
    expect(screen.getByRole('heading', { name: 'Files' })).toBeTruthy()
    expect(screen.getByText('b598 Quarry Road Storage Bunker')).toBeTruthy()
    expect(io.loads).toBe(1)
    expect(screen.getByText('No photos on this bid yet.')).toBeTruthy()
    expect(screen.getByText(/The first photo makes the folder: Quarry Road Storage Bunker › Team only › Photos/)).toBeTruthy()
    expect([...document.querySelectorAll('[data-bid-file-row]')].map((r) => r.getAttribute('data-bid-file-row'))).toEqual(['photos', 'folder', 'plans', 'count', 'submission'])
    expect([...document.querySelectorAll('[data-bid-file-row]')].every((r) => r.getAttribute('data-there') === 'no')).toBe(true)
    expect(document.querySelector('[data-pressed]')).toBeNull()
    expect(document.querySelector('[data-bid-file-edit]')).toBeNull()
    expect([...document.querySelectorAll('[data-bid-file-set]')].map((b) => b.textContent)).toEqual(['Set the link', 'Add a set', 'Set the link', 'Set the link'])
  })

  it('opens a grey link’s row with its box ready, holds what is not a link, then saves the link and tells the page', async () => {
    const io = makeIo()
    const filesIo = makeFilesIo()
    const changed = vi.fn()
    open(nothing, 'count', { io, filesIo, onFilesChanged: changed })
    await settle()
    expect(io.loads).toBe(0)
    expect(document.querySelector('[data-bid-photos-window]')).toBeNull()
    expect(rowOf('count').getAttribute('data-pressed')).toBe('yes')
    expect(boxOf('count')).toBeTruthy()
    expect(boxOf('folder')).toBeNull()
    expect(screen.getByText('Link to the CountTooling project')).toBeTruthy()
    expect(savePress().getAttribute('data-bid-file-save')).toBe('dead')

    fireEvent.change(linkInput('count'), { target: { value: 'counttooling.com/?t=abc' } })
    expect(screen.getByText('A link starts with https:// and has no spaces.')).toBeTruthy()
    expect(savePress().disabled).toBe(true)

    fireEvent.change(linkInput('count'), { target: { value: '  https://counttooling.com/?t=abc ' } })
    expect(savePress().getAttribute('data-bid-file-save')).toBe('live')
    fireEvent.click(savePress())
    await waitFor(() => expect(filesIo.saved).toEqual([{ bidId: bid.id, kind: 'count', value: 'https://counttooling.com/?t=abc' }]))
    await waitFor(() => expect(changed).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(boxOf('count')).toBeNull())
    expect(await screen.findByText('The CountTooling project is set.')).toBeTruthy()
  })

  it('keeps the box and says why when the save is refused', async () => {
    const changed = vi.fn()
    open(nothing, 'submission', { filesIo: makeFilesIo('This bid was not changed. You may not have access to it.'), onFilesChanged: changed })
    await settle()
    fireEvent.change(linkInput('submission'), { target: { value: 'https://drive.google.com/file/d/1Sent/view' } })
    fireEvent.click(savePress())
    expect((await screen.findByRole('alert')).textContent).toBe('This bid was not changed. You may not have access to it.')
    expect(boxOf('submission')).toBeTruthy()
    expect(changed).not.toHaveBeenCalled()
  })

  it('unfolds the photos on Add photos and reads them then', async () => {
    const io = makeIo()
    open(nothing, 'folder', { io })
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'Add photos' }))
    await waitFor(() => expect(io.loads).toBe(1))
    await waitFor(() => expect(screen.getByText('Drop photos here')).toBeTruthy())
    expect(document.querySelector('[data-bid-files-photos-open]')).toBeNull()
  })

  it('makes the project folder from its box, and a refusal keeps the box with its reason', async () => {
    const filesIo = makeFilesIo()
    const changed = vi.fn()
    const first = open(nothing, 'folder', { filesIo, onFilesChanged: changed })
    await settle()
    expect(screen.getByText('Or let the app make one in the company’s shared Drive, with the photo folder inside.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Make the project folder' }))
    await waitFor(() => expect(filesIo.made).toEqual([bid.id]))
    await waitFor(() => expect(changed).toHaveBeenCalledTimes(1))
    expect(await screen.findByText('Made the project folder: b598 Quarry Road Storage Bunker.')).toBeTruthy()
    await waitFor(() => expect(boxOf('folder')).toBeNull())
    first.unmount()

    open(nothing, 'folder', { filesIo: makeFilesIo('The app has no jobs folder to make it in.') })
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'Make the project folder' }))
    expect((await screen.findByRole('alert')).textContent).toBe('The app has no jobs folder to make it in.')
    expect(boxOf('folder')).toBeTruthy()
  })

  it('opens what the bid has, names each of three plan sets, and Change starts from the link the bid has', async () => {
    const edit = vi.fn()
    const close = vi.fn()
    open(full, 'submission', { io: makeIo([photo()]), onEditBid: edit, onClose: close })
    await settle()
    expect(rowOf('photos').textContent).toContain('1 photo')
    expect(screen.getByRole('button', { name: 'Show the photos' })).toBeTruthy()
    expect(rowOf('folder').getAttribute('data-there')).toBe('yes')
    expect(rowOf('folder').textContent).toContain('Linked · Google Drive')
    fireEvent.click(within(rowOf('folder')).getByRole('button', { name: 'Open ↗' }))
    expect(opened.urls).toEqual(['https://drive.google.com/drive/folders/1Project'])

    expect(rowOf('plans').textContent).toContain('3 sets')
    const sets = rowOf('plans').querySelectorAll('[data-bid-file-open="plans"]')
    expect([...sets].map((s) => s.querySelector('span')?.textContent)).toEqual(['Issued for bid', 'Addendum 1', 'Permit set'])
    fireEvent.click(sets[1]!.querySelector('button')!)
    expect(opened.urls[1]).toBe('https://drive.google.com/drive/folders/1Add')

    // The pressed row had nothing, so its box is open. Change on the folder moves the box there.
    expect(boxOf('submission')).toBeTruthy()
    fireEvent.click(within(rowOf('folder')).getByRole('button', { name: 'Change' }))
    expect(boxOf('submission')).toBeNull()
    expect(linkInput('folder').value).toBe('https://drive.google.com/drive/folders/1Project')
    expect(screen.getByText('That is the link the bid has now.')).toBeTruthy()
    expect(savePress().disabled).toBe(true)
    // A folder the bid already has is not made again.
    expect(screen.queryByRole('button', { name: 'Make the project folder' })).toBeNull()
    fireEvent.change(linkInput('folder'), { target: { value: 'https://www.dropbox.com/sh/abc' } })
    expect(screen.getByText('This is not a Google Drive folder. The bid’s photos cannot be filed there.')).toBeTruthy()
    expect(savePress().disabled).toBe(false)

    fireEvent.click(screen.getByRole('button', { name: 'Open Edit bid' }))
    expect(close).toHaveBeenCalledTimes(1)
    expect(edit).toHaveBeenCalledWith('driveLink')
  })

  it('opens the form’s plan sets field on Add a set, saves the robot’s set, and tells the page when it is put away', async () => {
    const filesIo = makeFilesIo()
    const changed = vi.fn()
    open(full, 'photos', { io: makeIo([photo()]), filesIo, onFilesChanged: changed })
    await settle()
    fireEvent.click(within(rowOf('plans')).getByRole('button', { name: 'Add a set' }))
    const field = screen.getByTestId('plan-sets-field')
    expect(field.getAttribute('data-bid')).toBe(bid.id)
    expect(field.getAttribute('data-plans-link')).toBe('https://drive.google.com/drive/folders/1Bid')
    // The field lists the sets itself, so the row's own list steps aside.
    expect(rowOf('plans').querySelectorAll('[data-bid-file-open="plans"]')).toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: 'Robot reads this set' }))
    await waitFor(() => expect(filesIo.plans).toEqual(['https://drive.google.com/drive/folders/1Robot']))
    await waitFor(() => expect(changed).toHaveBeenCalledTimes(1))
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(screen.queryByTestId('plan-sets-field')).toBeNull()
    expect(changed).toHaveBeenCalledTimes(2)
    expect(rowOf('plans').querySelectorAll('[data-bid-file-open="plans"]')).toHaveLength(3)
  })

  it('offers a training account no change, and says so', async () => {
    auth.readOnly = true
    open(nothing, 'count')
    await settle()
    expect(screen.getByText('A training account can look at a bid’s files and cannot change one.')).toBeTruthy()
    expect(document.querySelector('[data-bid-file-set]')).toBeNull()
    expect(document.querySelector('[data-bid-file-edit]')).toBeNull()
    expect(rowOf('count').textContent).toContain('Not linked yet')
  })

  it('shows one opened photo alone and comes back to the rows', async () => {
    open(full, 'photos', { io: makeIo([photo()]) })
    await settle()
    await waitFor(() => expect(document.querySelector('[data-bid-photo-tile="p1"]')).toBeTruthy())
    fireEvent.click(document.querySelector('[data-bid-photo-tile="p1"]')!)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Mechanical room north' })).toBeTruthy())
    expect(document.querySelector('[data-bid-file-row]')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Back to the photos' }))
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Files' })).toBeTruthy())
    expect(document.querySelectorAll('[data-bid-file-row]')).toHaveLength(5)
  })
})
