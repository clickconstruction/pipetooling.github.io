// @vitest-environment jsdom
/**
 * The Sub NDA's Edit / Share switch (punch list #416, part 3): Edit shows the map and the pages that changed, Share
 * shows the link and the send, and what a GC sees stays on the right under both. Both sides stay drawn, so a note half
 * typed in a send's box is still there after a look at the map. The rules are `builderSide.test.ts`.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { DOCUMENT_BUILDERS } from '../../lib/documentBuilder/builders'
import type { BuilderSide } from '../../lib/documentBuilder/builderSide'
import type { PaperDef } from '../../lib/documentBuilder/documentBuilder'
import { SECRECY_PAPER_FIXTURE } from '../../lib/documentBuilder/secrecyPaper.fixture'
import { builderRecordFromRow, type BuilderRecord } from '../../lib/documentBuilder/standing'
import { ConfirmDialogProvider } from '../../contexts/ConfirmDialogContext'
import type { BuilderLinkCardIo } from './BuilderLinkCard'
import { WalkedBuilder, type WalkedBuilderIo } from './WalkedBuilder'

afterEach(cleanup)

const ENTRY = DOCUMENT_BUILDERS.find((b) => b.id === 'sub-nda')!
const paper = (): PaperDef => JSON.parse(JSON.stringify(SECRECY_PAPER_FIXTURE)) as PaperDef
const rec = builderRecordFromRow({ key: 'sub-nda', kind: 'walked', draft: paper(), published: paper(), revision: 2, published_at: '2026-11-19T15:00:00.000Z', read_revision: null, read_by_name: '', read_on: null, updated_at: '2026-11-19T15:00:00.000Z' }) as BuilderRecord

const io: WalkedBuilderIo = { saveBuilderDraft: vi.fn(), publishBuilder: vi.fn(), markBuilderRead: vi.fn() }
const linkIo = () => ({ read: vi.fn(async () => ({ ok: true as const, value: { on: false as const } })), opens: vi.fn(async () => ({ ok: true as const, value: [] })), make: vi.fn(), end: vi.fn(), copy: vi.fn() })

/** A stand-in for the send card: a box someone types a note in. */
const SEND = (
  <div>
    <h3>Send it to a GC</h3>
    <textarea aria-label="A note" defaultValue="" />
  </div>
)

function draw(props: { side?: BuilderSide; onSide?: (side: BuilderSide) => void } = {}) {
  const link = linkIo()
  render(
    <ConfirmDialogProvider>
      <WalkedBuilder entry={ENTRY} rec={rec} def={rec.draft as PaperDef} onBack={vi.fn()} onRecord={vi.fn()} io={io} linkIo={link as unknown as BuilderLinkCardIo} share={SEND} {...props} />
    </ConfirmDialogProvider>,
  )
  return link
}

const press = (name: string) => fireEvent.click(screen.getByRole('button', { name }))
const pressed = (name: string) => screen.getByRole('button', { name }).getAttribute('aria-pressed')
const map = () => screen.queryByRole('table', { name: 'The map' })
const link = () => screen.queryByRole('heading', { level: 3, name: "This builder's link" })
const send = () => screen.queryByRole('heading', { level: 3, name: 'Send it to a GC' })
const changedCard = () => screen.queryByRole('heading', { level: 3, name: 'Nothing changed since revision 2' })

describe('the Edit / Share switch', () => {
  it('opens on Edit: the map and the changed pages show, and the link and the send do not', () => {
    draw()
    const group = screen.getByRole('group', { name: 'What the left side shows' })
    expect(Array.from(group.querySelectorAll('button')).map((b) => [b.textContent, b.getAttribute('aria-pressed')])).toEqual([
      ['Edit', 'true'],
      ['Share', 'false'],
    ])
    expect(screen.getByText('The map and the pages that changed.')).toBeTruthy()
    expect(map()).not.toBeNull()
    expect(changedCard()).not.toBeNull()
    expect(link()).toBeNull()
    expect(send()).toBeNull()
    // What a GC sees is on the right under both sides.
    expect(screen.getByText('Step 1 of 11')).toBeTruthy()
  })

  it('shows the link and the send on Share, hides the map, and comes back on Edit', () => {
    draw()
    press('Share')
    expect(pressed('Share')).toBe('true')
    expect(pressed('Edit')).toBe('false')
    expect(screen.getByText('The link and the send.')).toBeTruthy()
    expect(link()).not.toBeNull()
    expect(send()).not.toBeNull()
    expect(map()).toBeNull()
    expect(changedCard()).toBeNull()
    expect(screen.getByText('Step 1 of 11')).toBeTruthy()
    press('Edit')
    expect(map()).not.toBeNull()
    expect(send()).toBeNull()
  })

  it('keeps both sides drawn: a note typed on Share is still there after a look at the map', () => {
    draw()
    press('Share')
    fireEvent.change(screen.getByRole('textbox', { name: 'A note' }), { target: { value: 'A made-up note, half typed' } })
    press('Edit')
    expect(screen.queryByRole('textbox', { name: 'A note' })).toBeNull()
    press('Share')
    expect((screen.getByRole('textbox', { name: 'A note' }) as HTMLTextAreaElement).value).toBe('A made-up note, half typed')
  })

  it('reads the link once, when the builder opens, however often the side is switched', async () => {
    const io = draw()
    await waitFor(() => expect(io.read).toHaveBeenCalledTimes(1))
    press('Share')
    press('Edit')
    press('Share')
    expect(await screen.findByText('The link is off. Nobody can open this builder by link.')).toBeTruthy()
    expect(io.read).toHaveBeenCalledTimes(1)
  })

  it('tells whoever keeps the address of each press, and shows the side it is handed', () => {
    const heard: BuilderSide[] = []
    function Held() {
      const [side, setSide] = useState<BuilderSide>('share')
      return (
        <ConfirmDialogProvider>
          <WalkedBuilder entry={ENTRY} rec={rec} def={rec.draft as PaperDef} onBack={vi.fn()} onRecord={vi.fn()} io={io} linkIo={linkIo() as unknown as BuilderLinkCardIo} share={SEND} side={side} onSide={(next) => { heard.push(next); setSide(next) }} />
        </ConfirmDialogProvider>
      )
    }
    render(<Held />)
    // Handed Share, it opens on Share.
    expect(pressed('Share')).toBe('true')
    expect(send()).not.toBeNull()
    press('Edit')
    press('Share')
    expect(heard).toEqual(['edit', 'share'])
  })

  it('on a phone leaves the Share side alone on the screen, by the stylesheet', () => {
    draw({ side: 'share' })
    const split = document.querySelector('.documentBuilderSplit') as HTMLElement
    expect(split.getAttribute('data-side')).toBe('share')
    expect(split.querySelector('.documentBuilderGcView')).not.toBeNull()
    const css = readFileSync(join(process.cwd(), 'src/index.css'), 'utf8')
    const rule = css.match(/@media \(max-width: 720px\) \{\n {2}\.documentBuilderSplit\[data-side='share'\] \.documentBuilderGcView \{[^}]*\}/)?.[0] ?? ''
    expect(rule).toContain('display: none !important')
  })
})
