// @vitest-environment jsdom
/**
 * **Keep its files on the bid…** (punch list #368, PR 2) over a fake io: the press on a mail with a file we hold, the
 * form filled from the mail, the button counting what it will file, the set made once and the files filed one by one
 * past one that fails, the second try on the same set, a set already on the bid taken in place of a new one, and what
 * the mail draws when it is kept, when it has no file and when every file stayed in Gmail. Made-up mail and bids.
 */
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BidMailFile } from '../../lib/bids/bidMailSet'
import type { BidMailSetIo } from '../../lib/bids/bidMailSetIo'
import type { BidPlanSetRow } from '../../lib/bids/bidPlanSets'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { BidMailSetDoor } from './BidMailSetDoor'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

afterEach(cleanup)

const FOLDER = 'https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrStUvWxYz012345'
const MAIL = { subject: 'Re: Addendum 2, revised plumbing specs', who: 'Dana Whitfield to the bids box', at: '2026-11-16T15:04:00.000Z' }
const file = (over: Partial<BidMailFile> & { id: string }): BidMailFile => ({ name: `${over.id}.pdf`, mime: 'application/pdf', size: 2_202_009, copied: true, leftWhy: null, setId: null, ...over })
const set = (over: Partial<BidPlanSetRow> & { id: string; name: string }): BidPlanSetRow => ({ bid_id: 'b482', memo: '', plan_date: null, link: FOLDER, file_name: null, file_size: null, file_count: null, checked_at: null, check_note: null, created_by: null, created_at: '2026-10-30T12:00:00Z', updated_at: '2026-10-30T12:00:00Z', ...over })

type World = { files: BidMailFile[]; sets: BidPlanSetRow[]; failOn: Set<string>; keeps: Array<Record<string, string>>; saves: Array<{ setId: string; attachmentId: string }>; readFails: boolean }

/** A fake that behaves as the function does: a keep adds the set, a save marks the file. */
function fakeIo(over: Partial<World> = {}): { io: BidMailSetIo; world: World } {
  const world: World = { files: [], sets: [], failOn: new Set(), keeps: [], saves: [], readFails: false, ...over }
  const io: BidMailSetIo = {
    filesOf: async () => {
      if (world.readFails) throw { message: 'the signal was lost', code: '' }
      return world.files.map((f) => ({ ...f }))
    },
    setsOf: async () => world.sets.map((s) => ({ ...s })),
    mailOfSets: async () => new Map(),
    mailsOf: async () => [],
    keep: async (ask) => {
      world.keeps.push(ask)
      const made = set({ id: `set-${world.sets.length + 1}`, name: ask.name, link: `${FOLDER}-new` })
      world.sets.push(made)
      return { set: { id: made.id, bid_id: made.bid_id, name: made.name, link: made.link }, folderUrl: made.link, made: true, reused: false }
    },
    saveAttachment: async (setId, attachmentId) => {
      world.saves.push({ setId, attachmentId })
      if (world.failOn.has(attachmentId)) throw new Error('Drive did not answer')
      const f = world.files.find((x) => x.id === attachmentId)
      if (f) f.setId = setId
      return { driveFileId: `drive-${attachmentId}`, url: 'https://drive.example/file', folderUrl: FOLDER }
    },
  }
  return { io, world }
}

const draw = (io: BidMailSetIo, more: { say?: (words: string, tone: 'success' | 'error') => void; onKept?: () => void } = {}) =>
  renderWithProviders(<BidMailSetDoor bidId="b482" bidLabel="B482" messageId="m1" mail={MAIL} io={io} {...more} />)
const form = () => document.querySelector('[data-bid-mail-set="form"]') as HTMLElement

describe('BidMailSetDoor: the press on a mail tied to a bid', () => {
  it('keeps two files as a new set: the form filled from the mail, the button counting, the set made once, the mail then kept', async () => {
    const { io, world } = fakeIo({ files: [file({ id: 'specs' }), file({ id: 'p201', size: 880_640 }), file({ id: 'reissue', copied: false, leftWhy: 'too_big' })] })
    const say = vi.fn()
    const onKept = vi.fn()
    draw(io, { say, onKept })
    fireEvent.click(await screen.findByRole('button', { name: 'Keep its files on the bid…' }))
    const f = form()
    expect(f.textContent).toContain('Keep this mail’s files on B482')
    expect((within(f).getByDisplayValue('Addendum 2, revised plumbing specs') as HTMLInputElement).value).toBe('Addendum 2, revised plumbing specs')
    expect(within(f).getByDisplayValue('2026-11-16')).toBeTruthy()
    expect(within(f).getByDisplayValue('Came by mail from Dana Whitfield, Nov 16.')).toBeTruthy()
    expect(f.textContent).toContain('specs.pdf· 2.1 MB')
    expect(f.textContent).toContain('reissue.pdf · stays in Gmail, too big for us to keep')
    expect(f.textContent).toContain('Goes to the bid’s Drive folder, under Plans › Addendum 2, revised plumbing specs.')
    expect(f.textContent).toContain('1 file stays in Gmail. We hold no copy of it.')
    // No other set on the bid, so there is nothing to choose between.
    expect(within(f).queryByText('Put them in')).toBeNull()
    fireEvent.click(within(f).getByRole('button', { name: 'Keep 2 files as a set on B482' }))
    const result = await waitFor(() => {
      const el = document.querySelector('[data-bid-mail-set="result"]') as HTMLElement | null
      if (!el) throw new Error('no result yet')
      return el
    })
    expect(world.keeps).toEqual([{ bidId: 'b482', messageId: 'm1', name: 'Addendum 2, revised plumbing specs', memo: 'Came by mail from Dana Whitfield, Nov 16.', planDate: '2026-11-16' }])
    expect(world.saves).toEqual([
      { setId: 'set-1', attachmentId: 'specs' },
      { setId: 'set-1', attachmentId: 'p201' },
    ])
    expect(result.getAttribute('data-tone')).toBe('warning')
    expect(result.textContent).toContain('Kept on B482 as Addendum 2, revised plumbing specs. The mail’s 2 files are in the set’s folder. reissue.pdf stays in Gmail, too big for us to keep.')
    expect(within(result).getByText('Open the folder ↗').getAttribute('href')).toBe(`${FOLDER}-new`)
    expect(say).toHaveBeenCalledWith(expect.stringContaining('Kept on B482 as Addendum 2'), 'error')
    expect(onKept).toHaveBeenCalledTimes(1)
  })

  it('a file that fails does not stop the next, and File 1 file again tries it on the same set', async () => {
    const { io, world } = fakeIo({ files: [file({ id: 'specs' }), file({ id: 'p201' })], failOn: new Set(['specs']) })
    draw(io)
    fireEvent.click(await screen.findByRole('button', { name: 'Keep its files on the bid…' }))
    fireEvent.click(within(form()).getByRole('button', { name: 'Keep 2 files as a set on B482' }))
    const again = await screen.findByRole('button', { name: 'File 1 file again' })
    expect(document.querySelector('[data-bid-mail-set="result"]')!.textContent).toContain('The mail’s file is in the set’s folder. One file did not land: specs.pdf: Drive did not answer.')
    world.failOn.clear()
    fireEvent.click(again)
    await waitFor(() => expect(document.querySelector('[data-bid-mail-set="result"]')!.getAttribute('data-tone')).toBe('success'))
    // One set, and the second try went into it.
    expect(world.keeps).toHaveLength(1)
    expect(world.saves.map((s) => `${s.setId}:${s.attachmentId}`)).toEqual(['set-1:specs', 'set-1:p201', 'set-1:specs'])
    expect(screen.queryByRole('button', { name: 'File 1 file again' })).toBeNull()
  })

  it('unticking a file changes the count, and no file ticked makes the button dead', async () => {
    const { io, world } = fakeIo({ files: [file({ id: 'specs' }), file({ id: 'p201' })] })
    draw(io)
    fireEvent.click(await screen.findByRole('button', { name: 'Keep its files on the bid…' }))
    const boxes = within(form()).getAllByRole('checkbox') as HTMLInputElement[]
    fireEvent.click(boxes[1]!)
    expect(within(form()).getByRole('button', { name: 'Keep 1 file as a set on B482' })).toBeTruthy()
    fireEvent.click(boxes[0]!)
    expect((within(form()).getByRole('button', { name: 'Keep files' }) as HTMLButtonElement).disabled).toBe(true)
    expect(form().textContent).toContain('Tick a file to keep.')
    fireEvent.click(boxes[1]!)
    fireEvent.click(within(form()).getByRole('button', { name: 'Keep 1 file as a set on B482' }))
    await waitFor(() => expect(world.saves).toEqual([{ setId: 'set-1', attachmentId: 'p201' }]))
  })

  it('a set of the same name already on the bid takes the files, with no second set', async () => {
    const { io, world } = fakeIo({ files: [file({ id: 'sheet' })], sets: [set({ id: 'set-a2', name: 'Addendum 2, revised plumbing specs', plan_date: '2026-11-16' }), set({ id: 'set-issued', name: 'Issued set', plan_date: '2026-10-30' })] })
    draw(io)
    fireEvent.click(await screen.findByRole('button', { name: 'Keep its files on the bid…' }))
    const f = form()
    expect((within(f).getByRole('combobox') as HTMLSelectElement).value).toBe('set-a2')
    expect(within(f).getAllByRole('option').map((o) => o.textContent)).toEqual(['A new set', 'Addendum 2, revised plumbing specs · Nov 16, 2026', 'Issued set · Oct 30, 2026'])
    // A set already there needs no name, date or memo from the form.
    expect(within(f).queryByText('Name')).toBeNull()
    expect(f.textContent).toContain('Goes into the folder of Addendum 2, revised plumbing specs.')
    fireEvent.click(within(f).getByRole('button', { name: 'Add 1 file to Addendum 2, revised plumbing specs' }))
    await waitFor(() => expect(world.saves).toEqual([{ setId: 'set-a2', attachmentId: 'sheet' }]))
    expect(world.keeps).toEqual([])
    expect((await screen.findByRole('status')).textContent).toContain('Added to Addendum 2, revised plumbing specs on B482.')
  })

  it('a refusal from the keep stays in the form with its reason, and nothing is filed', async () => {
    const { io, world } = fakeIo({ files: [file({ id: 'specs' })] })
    io.keep = async () => {
      throw new Error('The app cannot open this bid’s project folder. Share it with app@example.iam as an editor. Nothing was made. The mail keeps its files.')
    }
    draw(io)
    fireEvent.click(await screen.findByRole('button', { name: 'Keep its files on the bid…' }))
    fireEvent.click(within(form()).getByRole('button', { name: 'Keep 1 file as a set on B482' }))
    expect((await screen.findByRole('alert')).textContent).toContain('The app cannot open this bid’s project folder.')
    expect(world.saves).toEqual([])
    expect(form()).toBeTruthy()
  })
})

describe('BidMailSetDoor: what the mail says with no press', () => {
  it('a kept mail wears its mark and the door to the set, and offers no press', async () => {
    const { io } = fakeIo({ files: [file({ id: 'specs', setId: 'set-a2' }), file({ id: 'reissue', copied: false })], sets: [set({ id: 'set-a2', name: 'Addendum 2' })] })
    draw(io)
    const kept = await waitFor(() => {
      const el = document.querySelector('[data-bid-mail-set="kept"]') as HTMLElement | null
      if (!el) throw new Error('not yet')
      return el
    })
    expect(kept.textContent).toContain('Kept as Addendum 2 on B482')
    expect(within(kept).getByText('Open the set ↗').getAttribute('href')).toBe(FOLDER)
    expect(screen.queryByRole('button', { name: 'Keep its files on the bid…' })).toBeNull()
  })

  it('a mail with one file kept and one not shows both the mark and the press', async () => {
    const { io } = fakeIo({ files: [file({ id: 'specs', setId: 'set-a2' }), file({ id: 'late' })], sets: [set({ id: 'set-a2', name: 'Addendum 2' })] })
    draw(io)
    expect(await screen.findByRole('button', { name: 'Keep its files on the bid…' })).toBeTruthy()
    expect(document.querySelector('[data-bid-mail-set="kept"]')!.textContent).toContain('Kept as Addendum 2 on B482')
    fireEvent.click(screen.getByRole('button', { name: 'Keep its files on the bid…' }))
    expect(form().textContent).toContain('specs.pdf · already in Addendum 2')
  })

  it('a mail with no file draws nothing, and one whose files all stayed in Gmail says why', async () => {
    const none = fakeIo({ files: [] })
    const first = draw(none.io)
    await waitFor(() => expect(first.container.textContent).toBe(''))
    cleanup()
    const left = fakeIo({ files: [file({ id: 'big', copied: false, leftWhy: 'too_big' })] })
    draw(left.io)
    await waitFor(() => expect(document.querySelector('[data-bid-mail-set="left"]')!.textContent).toBe('This mail’s file stayed in Gmail, so there is no copy here to keep on the bid.'))
  })

  it('a read that fails says so with its reason and reads again on the press', async () => {
    const { io, world } = fakeIo({ files: [file({ id: 'specs' })], readFails: true })
    draw(io)
    expect((await screen.findByRole('alert')).textContent).toContain('the signal was lost')
    world.readFails = false
    fireEvent.click(screen.getByRole('button', { name: 'Read again' }))
    expect(await screen.findByRole('button', { name: 'Keep its files on the bid…' })).toBeTruthy()
  })
})
