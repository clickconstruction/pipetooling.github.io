// @vitest-environment jsdom
/**
 * The Sub NDA open in the Document builder tab, when its row moved on somewhere else (punch list #404): a save or a
 * publish refused because a teammate or another tab changed the builder is held, what was typed stays on the page,
 * and the panel's two presses settle it. The guard itself is held by `sheetsIo.test.ts` and the beds. Every word is
 * the made-up paper's.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ConfirmDialogProvider } from '../../contexts/ConfirmDialogContext'
import { DOCUMENT_BUILDERS } from '../../lib/documentBuilder/builders'
import type { PaperDef } from '../../lib/documentBuilder/documentBuilder'
import { MOVED_ON_PUBLISH, MOVED_ON_SAVE, type Landed } from '../../lib/documentBuilder/documentBuildersIo'
import { MOVED_ON_KEEP, MOVED_ON_LOAD } from '../../lib/documentBuilder/movedOn'
import { SECRECY_PAPER_FIXTURE } from '../../lib/documentBuilder/secrecyPaper.fixture'
import { builderRecordFromRow, type BuilderRecord } from '../../lib/documentBuilder/standing'
import type { BuilderLinkCardIo } from './BuilderLinkCard'
import { WalkedBuilder, type WalkedBuilderIo } from './WalkedBuilder'

afterEach(cleanup)

const ENTRY = DOCUMENT_BUILDERS.find((b) => b.id === 'sub-nda')!
const paper = (title?: string): PaperDef => {
  const def = JSON.parse(JSON.stringify(SECRECY_PAPER_FIXTURE)) as PaperDef
  return title ? { ...def, notice: { ...def.notice, title } } : def
}
const record = (over: Record<string, unknown> = {}): BuilderRecord =>
  builderRecordFromRow({ key: 'sub-nda', kind: 'walked', draft: paper(), published: paper(), revision: 2, draft_no: 7, published_at: '2026-11-19T15:00:00.000Z', read_revision: null, read_by_name: '', read_on: null, updated_at: null, ...over }) as BuilderRecord
/** What a teammate saved after this page read the builder. */
const newer = (over: Record<string, unknown> = {}) => record({ draft: paper('A title a teammate typed'), draft_no: 8, ...over })

const TITLE = "The disclaimer's title"
const PANEL = 'Sub NDA changed somewhere else'

function draw(over: Partial<WalkedBuilderIo> = {}) {
  let rec = record()
  const io = {
    saveBuilderDraft: vi.fn(async (_key: string, draft: unknown, draftNo: number): Promise<Landed<BuilderRecord>> => ({ ok: true, value: record({ draft, draft_no: draftNo + 1 }) })),
    publishBuilder: vi.fn(async (_key: string, from: number, contents: unknown, draftNo: number): Promise<Landed<BuilderRecord>> => ({ ok: true, value: record({ draft: contents, published: contents, revision: from + 1, draft_no: draftNo + 1 }) })),
    markBuilderRead: vi.fn(),
    ...over,
  }
  const onRecord = vi.fn()
  // The builder's link card reads no link here: it has its own smoke. It asks through the confirm window's provider.
  const linkIo = { read: vi.fn(async () => ({ ok: true as const, value: { on: false as const } })), make: vi.fn(), end: vi.fn(), copy: vi.fn(async () => true) } as unknown as BuilderLinkCardIo
  function Host() {
    return (
      <ConfirmDialogProvider>
        <WalkedBuilder entry={ENTRY} rec={rec} def={rec.draft as PaperDef} onBack={vi.fn()} onRecord={(next) => { onRecord(next); rec = next; view.rerender(<Host />) }} io={io as unknown as WalkedBuilderIo} linkIo={linkIo} />
      </ConfirmDialogProvider>
    )
  }
  const view = render(<Host />)
  return { io, onRecord }
}

function type(words: string) {
  const field = screen.getByRole('textbox', { name: TITLE })
  field.textContent = words
  fireEvent.input(field)
}
const title = () => screen.getByRole('textbox', { name: TITLE }).textContent
const refusedOnce = () =>
  vi
    .fn(async (_key: string, draft: unknown, draftNo: number): Promise<Landed<BuilderRecord>> => ({ ok: true, value: record({ draft, draft_no: draftNo + 1 }) }))
    .mockResolvedValueOnce({ ok: false, error: MOVED_ON_SAVE, movedOn: newer() })

describe('WalkedBuilder, when the builder moved on somewhere else', () => {
  it('holds the refused save, keeps what was typed, and stops the publish', async () => {
    const saveBuilderDraft = refusedOnce()
    const { io } = draw({ saveBuilderDraft })
    type('A title typed on this page')
    expect(await screen.findByText(PANEL, undefined, { timeout: 3000 })).toBeTruthy()
    expect(saveBuilderDraft.mock.calls[0]?.[2]).toBe(7)
    expect(screen.getByText('A newer draft was saved after this page read it.')).toBeTruthy()
    expect(title()).toBe('A title typed on this page')
    expect(screen.getByText('Draft not saved')).toBeTruthy()
    const publish = screen.getByRole('button', { name: 'Publish revision 3' }) as HTMLButtonElement
    expect(publish.disabled).toBe(true)
    fireEvent.click(publish)
    expect(io.publishBuilder).not.toHaveBeenCalled()
    // More typing waits: no save is sent while the choice is open.
    type('A title typed on this page, again')
    await new Promise((r) => setTimeout(r, 900))
    expect(saveBuilderDraft).toHaveBeenCalledTimes(1)
  })

  it('loads the newer one on the press, and saves nothing over it', async () => {
    const saveBuilderDraft = refusedOnce()
    const { onRecord } = draw({ saveBuilderDraft })
    type('A title typed on this page')
    await screen.findByText(PANEL, undefined, { timeout: 3000 })
    fireEvent.click(screen.getByRole('button', { name: MOVED_ON_LOAD }))
    await waitFor(() => expect(title()).toBe('A title a teammate typed'))
    expect(screen.queryByText(PANEL)).toBeNull()
    expect(onRecord).toHaveBeenLastCalledWith(newer())
    expect(screen.getByText('Draft saved')).toBeTruthy()
    await new Promise((r) => setTimeout(r, 900))
    expect(saveBuilderDraft).toHaveBeenCalledTimes(1)
  })

  it('saves mine over it on the press, naming the number the newer draft is on', async () => {
    const saveBuilderDraft = refusedOnce()
    draw({ saveBuilderDraft })
    type('A title typed on this page')
    await screen.findByText(PANEL, undefined, { timeout: 3000 })
    fireEvent.click(screen.getByRole('button', { name: MOVED_ON_KEEP }))
    await waitFor(() => expect(saveBuilderDraft).toHaveBeenCalledTimes(2))
    expect((saveBuilderDraft.mock.calls[1]?.[1] as PaperDef).notice.title).toBe('A title typed on this page')
    expect(saveBuilderDraft.mock.calls[1]?.[2]).toBe(8)
    expect(screen.queryByText(PANEL)).toBeNull()
    expect(title()).toBe('A title typed on this page')
    expect(await screen.findByText('Draft saved')).toBeTruthy()
  })

  it('holds a publish refused because someone published first, and says which revision', async () => {
    const publishBuilder = vi.fn(async (): Promise<Landed<BuilderRecord>> => ({ ok: false, error: MOVED_ON_PUBLISH, movedOn: newer({ published: paper('A title a teammate typed'), revision: 3, draft_no: 9 }) }))
    draw({ publishBuilder })
    type('A title typed on this page')
    fireEvent.click(screen.getByRole('button', { name: 'Publish revision 3' }))
    expect(await screen.findByText(PANEL, undefined, { timeout: 3000 })).toBeTruthy()
    expect(screen.getByText('Revision 3 was published after this page read it.')).toBeTruthy()
    // The draft was saved first, naming the number it read, and the publish named the number that save left.
    expect(publishBuilder.mock.calls[0]?.slice(1, 2)).toEqual([2])
    expect((publishBuilder.mock.calls[0] as unknown[])[3]).toBe(8)
    expect(title()).toBe('A title typed on this page')
  })
})
