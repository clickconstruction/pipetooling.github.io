// @vitest-environment jsdom
/**
 * The card of changed pages on the Sub NDA's editor, and the open cell on its map (punch list #416, part 3): the
 * card's count, its legend of the two marks, a changed page's level drawn apart from its name, and the outline that
 * follows the page open on the right. The rules are `changedCard.test.ts`. Every word is the made-up paper's.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { DOCUMENT_BUILDERS } from '../../lib/documentBuilder/builders'
import type { PaperDef } from '../../lib/documentBuilder/documentBuilder'
import { SECRECY_PAPER_FIXTURE } from '../../lib/documentBuilder/secrecyPaper.fixture'
import { builderRecordFromRow, type BuilderRecord } from '../../lib/documentBuilder/standing'
import { ConfirmDialogProvider } from '../../contexts/ConfirmDialogContext'
import type { BuilderLinkCardIo } from './BuilderLinkCard'
import { WalkedBuilder, type WalkedBuilderIo } from './WalkedBuilder'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const ENTRY = DOCUMENT_BUILDERS.find((b) => b.id === 'sub-nda')!
const paper = (): PaperDef => JSON.parse(JSON.stringify(SECRECY_PAPER_FIXTURE)) as PaperDef

function record(over: Record<string, unknown> = {}): BuilderRecord {
  return builderRecordFromRow({ key: 'sub-nda', kind: 'walked', draft: paper(), published: paper(), revision: 2, published_at: '2026-11-19T15:00:00.000Z', read_revision: null, read_by_name: '', read_on: null, updated_at: '2026-11-19T15:00:00.000Z', ...over }) as BuilderRecord
}

function draw(rec = record()) {
  const landed = (r: BuilderRecord) => Promise.resolve({ ok: true as const, value: r })
  const io: WalkedBuilderIo = {
    saveBuilderDraft: vi.fn((_key: string, draft: unknown) => landed(record({ draft, published: rec.published, revision: rec.revision }))),
    publishBuilder: vi.fn((_key: string, from: number, contents: unknown) => landed(record({ draft: contents, published: contents, revision: from + 1 }))),
    markBuilderRead: vi.fn((_key: string, revision: number, byName: string, on: string) => landed(record({ read_revision: revision, read_by_name: byName, read_on: on }))),
  }
  const linkIo = { read: vi.fn(async () => ({ ok: true as const, value: { on: false as const } })), opens: vi.fn(async () => ({ ok: true as const, value: [] })), make: vi.fn(), end: vi.fn(), copy: vi.fn() }
  render(
    <ConfirmDialogProvider>
      <WalkedBuilder entry={ENTRY} rec={rec} def={rec.draft as PaperDef} onBack={vi.fn()} onRecord={vi.fn()} io={io} linkIo={linkIo as unknown as BuilderLinkCardIo} />
    </ConfirmDialogProvider>,
  )
}

/** Type over a field, as the browser does: the words change under the caret, then the input event. */
function type(field: HTMLElement, words: string) {
  field.textContent = words
  fireEvent.input(field)
}

const card = () => document.querySelector('[data-changed-card]') as HTMLElement
const pressed = () => Array.from(document.querySelectorAll('.documentBuilderMapCell[aria-pressed="true"]')).map((c) => c.getAttribute('aria-label'))

describe('the card of changed pages', () => {
  it('says nothing changed, shows what the two marks mean, and lists no page', () => {
    draw()
    expect(within(card()).getByRole('heading', { level: 3 }).textContent).toBe('Nothing changed since revision 2')
    expect(within(card()).getByText('Nothing waiting on a publish. This is revision 2.')).toBeTruthy()
    const legend = within(card()).getByLabelText('What the marks mean')
    expect(Array.from(legend.children).map((m) => [m.getAttribute('data-mark'), m.textContent, m.className])).toEqual([
      ['usual', 'As published', 'documentBuilderField'],
      ['own', 'Changed, not published', 'documentBuilderField'],
    ])
    // The legend's marks are looks, never fields: nothing in the card can be typed on.
    expect(within(card()).queryAllByRole('textbox')).toEqual([])
    expect(card().querySelectorAll('[data-changed-page]')).toHaveLength(0)
  })

  it('counts the changed pages in its head, the count and the revision drawn as values', () => {
    vi.useFakeTimers()
    draw()
    type(screen.getByRole('textbox', { name: "The disclaimer's title" }), 'Before anything else')
    const head = within(card()).getByRole('heading', { level: 3 })
    expect(head.textContent).toBe('1 page changed since revision 2')
    expect(Array.from(head.querySelectorAll('[data-value="worked-out"]')).map((v) => v.textContent)).toEqual(['1 page', '2'])
    expect(within(card()).queryByText('Nothing waiting on a publish. This is revision 2.')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Phones and devices, Elevated' }))
    type(screen.getByRole('textbox', { name: 'What Phones and devices at Elevated means' }), 'Made-up words for the test.')
    expect(head.textContent).toBe('2 pages changed since revision 2')
  })

  it('lists a changed topic by its name with its level apart, and marks the row whose page is open', () => {
    vi.useFakeTimers()
    draw()
    type(screen.getByRole('textbox', { name: "The disclaimer's title" }), 'Before anything else')
    fireEvent.click(screen.getByRole('button', { name: 'Phones and devices, Elevated' }))
    type(screen.getByRole('textbox', { name: 'What Phones and devices at Elevated means' }), 'Made-up words for the test.')

    const phones = SECRECY_PAPER_FIXTURE.topics.find((t) => t.label === 'Phones and devices')?.key
    const row = card().querySelector(`[data-changed-page="topic:${phones}:gov"]`) as HTMLElement
    expect(row).not.toBeNull()
    const [name, level] = Array.from(row.firstElementChild?.children ?? [])
    expect(name?.textContent).toBe('Phones and devices')
    expect(level?.textContent).toBe('Elevated')
    expect(row.getAttribute('aria-current')).toBe('true')
    expect(card().querySelector('[data-changed-page="notice"]')?.getAttribute('aria-current')).toBeNull()
    // The presses still say the whole page aloud.
    expect(within(row).getByRole('button', { name: 'Open Phones and devices, Elevated' })).toBeTruthy()
    expect(within(row).getByRole('button', { name: 'Put Phones and devices, Elevated back to revision 2' })).toBeTruthy()

    // Open it, from another page, shows the page and moves the mark. The clock is held here, and a press opens a
    // page by the moment it was pressed, so the clock moves on between the two presses as a person's would.
    vi.advanceTimersByTime(5)
    fireEvent.click(within(card().querySelector('[data-changed-page="notice"]') as HTMLElement).getByRole('button', { name: 'Open Before you start' }))
    expect(screen.getByText('Step 1 of 11')).toBeTruthy()
    expect(card().querySelector('[data-changed-page="notice"]')?.getAttribute('aria-current')).toBe('true')
    expect(row.getAttribute('aria-current')).toBeNull()
  })

  it('before the first publish says so, with what to press and no legend', () => {
    draw(record({ published: null, revision: 0, published_at: null }))
    expect(within(card()).getByRole('heading', { level: 3 }).textContent).toBe('Not published yet')
    expect(within(card()).getByText('Every word here is a draft. Publish to make revision 1.')).toBeTruthy()
    expect(within(card()).queryByLabelText('What the marks mean')).toBeNull()
  })
})

describe('the open cell on the map', () => {
  it('is none on the disclaimer, and the pressed cell once the map opens a page', () => {
    draw()
    expect(pressed()).toEqual([])
    fireEvent.click(screen.getByRole('button', { name: 'Phones and devices, Elevated' }))
    expect(pressed()).toEqual(['Phones and devices, Elevated'])
    fireEvent.click(screen.getByRole('button', { name: 'Photos and video, Strict' }))
    expect(pressed()).toEqual(['Photos and video, Strict'])
  })

  it('follows the flow: Next moves it to the next topic at that topic’s own level, and Review leaves no cell open', () => {
    draw()
    fireEvent.click(screen.getByRole('button', { name: 'Phones and devices, Elevated' }))
    const step = screen.getByText('Step 5 of 11')
    expect(step).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /^Next: / }))
    expect(screen.getByText('Step 6 of 11')).toBeTruthy()
    // The next topic stands on the basis, the loosest level, so its Standard cell is the open one.
    expect(pressed()).toHaveLength(1)
    expect(pressed()[0]).toMatch(/, Standard$/)
    expect(pressed()[0]).not.toContain('Phones and devices')

    fireEvent.click(screen.getByRole('button', { name: 'Step 11: Review' }))
    expect(pressed()).toEqual([])
  })

  it('is outlined by the stylesheet in its level’s colour, at every width', () => {
    const css = readFileSync(join(process.cwd(), 'src/index.css'), 'utf8')
    const rule = css.match(/\.documentBuilderMapCell\[aria-pressed='true'\] \{[^}]*\}/)?.[0] ?? ''
    expect(rule).toContain('outline: 2px solid var(--tone)')
    expect(rule).toContain('outline-offset: 1px')
    // It is not inside the phone's block: the rule comes before the first media query of the map.
    expect(css.indexOf(".documentBuilderMapCell[aria-pressed='true']")).toBeLessThan(css.indexOf('@media (max-width: 720px) {\n  .documentBuilderMap {'))
  })
})
