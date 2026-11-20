// @vitest-environment jsdom
/**
 * The Sub NDA open in the Document builder tab (punch list #404, step 7): the map, typing on what a GC sees, the
 * pages changed since the published revision with the way back, the publish, the marks and the attorney's read. The
 * flow's own wiring is `DocumentBuilderFlow.render.test.tsx`. Every word is the made-up paper's.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { DOCUMENT_BUILDERS } from '../../lib/documentBuilder/builders'
import type { PaperDef } from '../../lib/documentBuilder/documentBuilder'
import { SECRECY_PAPER_FIXTURE } from '../../lib/documentBuilder/secrecyPaper.fixture'
import { builderRecordFromRow, type BuilderRecord } from '../../lib/documentBuilder/standing'
import { WalkedBuilder, type WalkedBuilderIo } from './WalkedBuilder'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const ENTRY = DOCUMENT_BUILDERS.find((b) => b.id === 'sub-nda')!
const paper = (): PaperDef => JSON.parse(JSON.stringify(SECRECY_PAPER_FIXTURE)) as PaperDef

function record(over: Record<string, unknown> = {}): BuilderRecord {
  return builderRecordFromRow({
    key: 'sub-nda',
    kind: 'walked',
    draft: paper(),
    published: paper(),
    revision: 2,
    published_at: '2026-11-19T15:00:00.000Z',
    read_revision: null,
    read_by_name: '',
    read_on: null,
    updated_at: '2026-11-19T15:00:00.000Z',
    ...over,
  }) as BuilderRecord
}

function draw(rec = record()) {
  const landed = (r: BuilderRecord) => Promise.resolve({ ok: true as const, value: r })
  const io: WalkedBuilderIo = {
    saveBuilderDraft: vi.fn((_key: string, draft: unknown) => landed(record({ draft, published: rec.published, revision: rec.revision }))),
    publishBuilder: vi.fn((_key: string, from: number, contents: unknown) => landed(record({ draft: contents, published: contents, revision: from + 1 }))),
    markBuilderRead: vi.fn((_key: string, revision: number, byName: string, on: string) => landed(record({ read_revision: revision, read_by_name: byName, read_on: on }))),
  }
  const onRecord = vi.fn()
  const onBack = vi.fn()
  const view = render(<WalkedBuilder entry={ENTRY} rec={rec} def={rec.draft as PaperDef} onBack={onBack} onRecord={onRecord} io={io} />)
  return { io, onRecord, onBack, view, rec }
}

/** Type over a field, as the browser does: the words change under the caret, then the input event. */
function type(field: HTMLElement, words: string) {
  field.textContent = words
  fireEvent.input(field)
}

describe('WalkedBuilder', () => {
  it('draws the map, a row a topic and a column a level, and where the builder stands', () => {
    draw()
    const map = screen.getByRole('table', { name: 'The map' })
    expect(within(map).getAllByRole('button')).toHaveLength(28)
    expect(within(map).getByRole('button', { name: 'Photos and video, Standard' })).toBeTruthy()
    expect(screen.getByText('Published, revision 2')).toBeTruthy()
    expect(screen.getByText('Everyone outside sees revision 2, as you do.')).toBeTruthy()
    expect(screen.getByText('Nothing waiting on a publish. This is revision 2.')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Nothing to publish' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText('Step 1 of 11')).toBeTruthy()
  })

  it('opens a page from the map at its level, past the disclaimer', () => {
    draw()
    fireEvent.click(screen.getByRole('button', { name: 'Phones and devices, Elevated' }))
    expect(screen.getByText('Step 5 of 11')).toBeTruthy()
    expect((screen.getByRole('textbox', { name: 'What Phones and devices at Elevated means' }) as HTMLElement).textContent).toBe(SECRECY_PAPER_FIXTURE.topics[1]?.levels.gov?.says)
  })

  it('saves what is typed a moment after the typing rests, and lists the page as changed with the way back', async () => {
    vi.useFakeTimers()
    const { io, onRecord } = draw()
    type(screen.getByRole('textbox', { name: "The disclaimer's title" }), 'Before anything else')
    expect(screen.getByText('Saving the draft…')).toBeTruthy()
    expect(io.saveBuilderDraft).not.toHaveBeenCalled()
    expect(screen.getByText('Changes not published')).toBeTruthy()
    expect(screen.getByText('Changed. Everyone outside sees revision 2 until you publish.')).toBeTruthy()
    const changed = document.querySelector('[data-changed-page="notice"]') as HTMLElement
    expect(within(changed).getByText('Before you start')).toBeTruthy()
    expect(screen.getByRole('textbox', { name: "The disclaimer's title" }).getAttribute('data-mark')).toBe('own')
    await act(async () => {
      await vi.advanceTimersByTimeAsync(800)
    })
    expect(io.saveBuilderDraft).toHaveBeenCalledTimes(1)
    expect((vi.mocked(io.saveBuilderDraft).mock.calls[0]?.[1] as PaperDef).notice.title).toBe('Before anything else')
    expect(onRecord).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Draft saved')).toBeTruthy()

    fireEvent.click(within(changed).getByRole('button', { name: 'Put Before you start back to revision 2' }))
    expect(document.querySelector('[data-changed-page="notice"]')).toBeNull()
    expect(screen.getByRole('textbox', { name: "The disclaimer's title" }).getAttribute('data-mark')).toBe('usual')
    await act(async () => {
      await vi.advanceTimersByTimeAsync(800)
    })
    expect((vi.mocked(io.saveBuilderDraft).mock.calls[1]?.[1] as PaperDef).notice.title).toBe(SECRECY_PAPER_FIXTURE.notice.title)
  })

  it('marks a changed cell on the map and opens it from the list', () => {
    draw()
    fireEvent.click(screen.getByRole('button', { name: 'Photos and video, Standard' }))
    type(screen.getByRole('textbox', { name: 'What Photos and video at Standard means' }), 'A made-up line.')
    expect(screen.getByRole('button', { name: 'Photos and video, Standard, changed' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Step 1: Before you start' }))
    fireEvent.click(screen.getByRole('button', { name: 'Open Photos and video, Standard' }))
    expect(screen.getByText('Step 4 of 11')).toBeTruthy()
  })

  it('adds a line and takes one off, and holds the publish while a new line has no words', () => {
    draw()
    fireEvent.click(screen.getByRole('button', { name: 'Add a line to the disclaimer' }))
    const n = SECRECY_PAPER_FIXTURE.notice.lines.length
    expect(screen.getByRole('textbox', { name: `the disclaimer, line ${n + 1}` }).textContent).toBe('A new line.')
    expect((screen.getByRole('button', { name: 'Publish revision 3' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText('A new line has no words yet.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: `Remove line ${n + 1} of the disclaimer` }))
    expect(screen.getByRole('button', { name: 'Nothing to publish' })).toBeTruthy()
  })

  it('publishes the draft as the next revision, saving what was typed last first', async () => {
    const { io, onRecord } = draw()
    type(screen.getByRole('textbox', { name: "The disclaimer's title" }), 'Before anything else')
    fireEvent.click(screen.getByRole('button', { name: 'Publish revision 3' }))
    await waitFor(() => expect(io.publishBuilder).toHaveBeenCalledTimes(1))
    expect(io.saveBuilderDraft).toHaveBeenCalledTimes(1)
    const [key, from, contents] = vi.mocked(io.publishBuilder).mock.calls[0] ?? []
    expect([key, from, (contents as PaperDef).notice.title]).toEqual(['sub-nda', 2, 'Before anything else'])
    await waitFor(() => expect(onRecord).toHaveBeenCalledTimes(2))
  })

  it('names a refusal and keeps what was typed', async () => {
    const { io } = draw()
    vi.mocked(io.publishBuilder).mockResolvedValueOnce({ ok: false, error: 'Someone else published revision 3. Read the page again.' })
    type(screen.getByRole('textbox', { name: "The disclaimer's title" }), 'Before anything else')
    fireEvent.click(screen.getByRole('button', { name: 'Publish revision 3' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Someone else published revision 3. Read the page again.')
    expect(screen.getByRole('textbox', { name: "The disclaimer's title" }).textContent).toBe('Before anything else')
  })

  it('reads as a GC does with the marks off: words and no fields', () => {
    draw()
    expect(screen.getAllByRole('textbox').length).toBeGreaterThan(3)
    fireEvent.click(screen.getByRole('switch', { name: 'Marks are on' }))
    expect(screen.queryAllByRole('textbox')).toHaveLength(0)
    expect(screen.getByRole('switch', { name: 'Marks are off, as a GC sees it' })).toBeTruthy()
    expect(screen.getByRole('checkbox', { name: SECRECY_PAPER_FIXTURE.notice.tick })).toBeTruthy()
  })

  it('marks the published revision as read by an attorney', async () => {
    const { io, onRecord } = draw()
    fireEvent.click(screen.getByRole('button', { name: 'Not read by an attorney. Mark it read' }))
    fireEvent.change(screen.getByLabelText('The attorney who read it'), { target: { value: 'Avery Stone' } })
    fireEvent.click(screen.getByRole('button', { name: 'Mark revision 2 as read' }))
    await waitFor(() => expect(io.markBuilderRead).toHaveBeenCalledTimes(1))
    expect(vi.mocked(io.markBuilderRead).mock.calls[0]?.slice(0, 3)).toEqual(['sub-nda', 2, 'Avery Stone'])
    expect(onRecord).toHaveBeenCalledTimes(1)
  })

  it('offers revision 1 on a builder never published, with nothing marked as changed', () => {
    draw(record({ published: null, revision: 0, published_at: null }))
    expect(screen.getByText('Draft, not published')).toBeTruthy()
    expect(screen.getByText('Nobody outside sees this until you publish.')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Publish revision 1' }) as HTMLButtonElement).disabled).toBe(false)
    expect(screen.getByText('Every word here is a draft. Publish to make revision 1.')).toBeTruthy()
    expect(document.querySelector('[data-mark="own"]')).toBeNull()
    expect(screen.getByText('Not read by an attorney')).toBeTruthy()
  })
})
