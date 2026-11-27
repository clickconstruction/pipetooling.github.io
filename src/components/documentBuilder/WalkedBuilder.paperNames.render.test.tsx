// @vitest-environment jsdom
/**
 * The paper's own names as fields on the Sub NDA's editor (punch list #416, part 3, the second of two PRs): the title,
 * the job, the company and who it protects, typed on a card of the Edit side, one fact a line. A changed name marks
 * its field, lists *The paper's names* among the changed pages with the way back and no press that opens nothing, and
 * an empty name holds the publish. The rules are `paperNames.test.ts`. Every name is made up.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { DOCUMENT_BUILDERS } from '../../lib/documentBuilder/builders'
import type { PaperDef } from '../../lib/documentBuilder/documentBuilder'
import { SECRECY_PAPER_FIXTURE as DEF } from '../../lib/documentBuilder/secrecyPaper.fixture'
import { builderRecordFromRow, type BuilderRecord } from '../../lib/documentBuilder/standing'
import { ConfirmDialogProvider } from '../../contexts/ConfirmDialogContext'
import type { BuilderLinkCardIo } from './BuilderLinkCard'
import { WalkedBuilder, type WalkedBuilderIo } from './WalkedBuilder'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const ENTRY = DOCUMENT_BUILDERS.find((b) => b.id === 'sub-nda')!
const paper = (): PaperDef => JSON.parse(JSON.stringify(DEF)) as PaperDef

function record(over: Record<string, unknown> = {}): BuilderRecord {
  return builderRecordFromRow({ key: 'sub-nda', kind: 'walked', draft: paper(), published: paper(), revision: 2, published_at: '2026-11-19T15:00:00.000Z', read_revision: null, read_by_name: '', read_on: null, updated_at: '2026-11-19T15:00:00.000Z', ...over }) as BuilderRecord
}

function draw(rec = record()) {
  const landed = (r: BuilderRecord) => Promise.resolve({ ok: true as const, value: r })
  const io: WalkedBuilderIo = {
    saveBuilderDraft: vi.fn((_key: string, draft: unknown) => landed(record({ draft, published: rec.published, revision: rec.revision }))),
    publishBuilder: vi.fn((_key: string, from: number, contents: unknown) => landed(record({ draft: contents, published: contents, revision: from + 1 }))),
    markBuilderRead: vi.fn(),
  }
  const linkIo = { read: vi.fn(async () => ({ ok: true as const, value: { on: false as const } })), opens: vi.fn(async () => ({ ok: true as const, value: [] })), make: vi.fn(), end: vi.fn(), copy: vi.fn() }
  render(
    <ConfirmDialogProvider>
      <WalkedBuilder entry={ENTRY} rec={rec} def={rec.draft as PaperDef} onBack={vi.fn()} onRecord={vi.fn()} io={io} linkIo={linkIo as unknown as BuilderLinkCardIo} />
    </ConfirmDialogProvider>,
  )
  return io
}

/** Type over a field, as the browser does: the words change under the caret, then the input event. */
function type(field: HTMLElement, words: string) {
  field.textContent = words
  fireEvent.input(field)
}

const names = () => document.querySelector('[data-paper-names]') as HTMLElement
const field = (name: string) => within(names()).getByRole('textbox', { name })
const changedRow = () => document.querySelector('[data-changed-page="paper"]') as HTMLElement | null

describe('the paper’s names, on the Edit side', () => {
  it('are four fields, one fact a line, each holding the paper’s own words', () => {
    draw()
    expect(within(names()).getByRole('heading', { level: 3 }).textContent).toBe("The paper's names")
    const lines = names().querySelector('[data-value-lines]') as HTMLElement
    expect(Array.from(lines.querySelectorAll('.vipLineLabel')).map((l) => l.textContent)).toEqual(['Title', 'Job', 'Your company', 'Who it protects'])
    expect(within(names()).getAllByRole('textbox').map((f) => [f.getAttribute('aria-label'), f.textContent, f.getAttribute('data-mark')])).toEqual([
      ["The paper's title", DEF.title, 'usual'],
      ['The job the paper is written for', DEF.job, 'usual'],
      ["Your company's name on the paper", DEF.company, 'usual'],
      ['Who the paper protects', DEF.protectedParty, 'usual'],
    ])
    expect(changedRow()).toBeNull()
  })

  it('saves a typed name a moment after the typing rests, marks its field, and counts the page as changed', async () => {
    vi.useFakeTimers()
    const io = draw()
    type(field('Who the paper protects'), 'A made-up owner')
    expect(field('Who the paper protects').getAttribute('data-mark')).toBe('own')
    expect(field("The paper's title").getAttribute('data-mark')).toBe('usual')
    expect(screen.getByRole('heading', { level: 3, name: '1 page changed since revision 2' })).toBeTruthy()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(800)
    })
    expect(io.saveBuilderDraft).toHaveBeenCalledTimes(1)
    const saved = vi.mocked(io.saveBuilderDraft).mock.calls[0]?.[1] as PaperDef
    expect(saved.protectedParty).toBe('A made-up owner')
    expect(saved.title).toBe(DEF.title)
  })

  it('lists The paper’s names with the way back, and no press that opens nothing', () => {
    vi.useFakeTimers()
    draw()
    type(field("Your company's name on the paper"), 'A made-up company')
    const row = changedRow() as HTMLElement
    expect(row).not.toBeNull()
    expect(within(row).getByText("The paper's names")).toBeTruthy()
    // No step on the right shows the names, so the row says where they are typed and offers no Open it.
    expect(within(row).queryByRole('button', { name: /^Open / })).toBeNull()
    expect(within(row).getByText('Typed on the card below.')).toBeTruthy()
    fireEvent.click(within(row).getByRole('button', { name: "Put The paper's names back to revision 2" }))
    expect(changedRow()).toBeNull()
    expect(field("Your company's name on the paper").textContent).toBe(DEF.company)
    expect(field("Your company's name on the paper").getAttribute('data-mark')).toBe('usual')
  })

  it('holds the publish while a name is empty, and says which', () => {
    vi.useFakeTimers()
    draw()
    type(field("The paper's title"), '')
    const press = screen.getByRole('button', { name: 'Publish revision 3' }) as HTMLButtonElement
    expect(press.disabled).toBe(true)
    expect(screen.getByText('The paper has no title.')).toBeTruthy()
    type(field("The paper's title"), 'A made-up title')
    expect((screen.getByRole('button', { name: 'Publish revision 3' }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('reads as plain words with the marks off, like every other word on the builder', () => {
    draw()
    fireEvent.click(screen.getByRole('switch', { name: 'Marks are on' }))
    expect(screen.queryAllByRole('textbox')).toEqual([])
    expect(within(names()).getByText(DEF.title)).toBeTruthy()
    expect(within(names()).getByText(DEF.protectedParty)).toBeTruthy()
    fireEvent.click(screen.getByRole('switch'))
    expect(within(names()).getAllByRole('textbox')).toHaveLength(4)
  })

  it('marks nothing before the first publish, and is not on the Share side', () => {
    draw(record({ published: null, revision: 0, published_at: null }))
    type(field('The job the paper is written for'), 'A made-up job')
    expect(field('The job the paper is written for').getAttribute('data-mark')).toBe('usual')
    fireEvent.click(screen.getByRole('button', { name: 'Share' }))
    expect(screen.queryByRole('textbox', { name: "The paper's title" })).toBeNull()
  })
})
