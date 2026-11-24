// @vitest-environment jsdom
/**
 * The rest of the flow's own words as fields (punch list #416, part 3; #404's step 7 left them plain): a topic's
 * section name, the names of the facts above the basis slider, what the basis page says when the paper is Off, and the
 * last step's press with the line under it. Each is a field for the person who edits, at the path `flowFields.ts`
 * names, and plain words for anyone who walks the flow. Every word is the made-up paper's.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { DocumentBuilderFlow, type FlowEdit } from './DocumentBuilderFlow'
import type { PaperDef } from '../../lib/documentBuilder/documentBuilder'
import { withPaperWords } from '../../lib/documentBuilder/paperEdit'
import { SECRECY_PAPER_FIXTURE as DEF } from '../../lib/documentBuilder/secrecyPaper.fixture'

afterEach(cleanup)

const press = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }))
const slide = (to: number) => fireEvent.change(screen.getByRole('slider'), { target: { value: String(to * 100) } })
const field = (name: string) => screen.getByRole('textbox', { name })
/** Type over a field, as the browser does: the words change under the caret, then the input event. */
function type(el: HTMLElement, words: string) {
  el.textContent = words
  fireEvent.input(el)
}

/** The flow as the editor holds it: the draft in state, each typed path written into it, and every change told to the smoke. */
function Editing({ onWords }: { onWords: (path: string, words: string) => void }) {
  const [draft, setDraft] = useState<PaperDef>(DEF)
  const edit: FlowEdit = {
    mark: () => 'usual',
    onWords: (path, words) => {
      onWords(path, words)
      setDraft((d) => withPaperWords(d, path, words))
    },
    onAddLine: () => {},
    onRemoveLine: () => {},
  }
  return <DocumentBuilderFlow def={draft} edit={edit} />
}

function edit() {
  const onWords = vi.fn()
  render(<Editing onWords={onWords} />)
  fireEvent.click(screen.getByRole('checkbox'))
  return onWords
}

const PHOTOS = DEF.topics.find((t) => t.key === 'photos')!
const TERM = DEF.topics.find((t) => t.fact != null)!

describe('the flow’s own words, for the person who edits', () => {
  it('makes a topic’s section name a field on the clause strip', () => {
    const onWords = edit()
    press('Step 4: Photos and video')
    const section = field('The section name of Photos and video')
    expect(section.textContent).toBe(PHOTOS.section)
    type(section, 'A made-up section')
    expect(onWords).toHaveBeenLastCalledWith('topic.photos.section', 'A made-up section')
  })

  it('makes each fact’s name above the basis slider a field, and leaves its value worked out', () => {
    const onWords = edit()
    press('Next: The basis')
    const facts = document.querySelector('[data-level-facts]') as HTMLElement
    const names = Array.from(facts.querySelectorAll('[role="textbox"]'))
    // One name a fact: every topic with a blank, then the count of what the site must have.
    expect(names.map((n) => n.textContent)).toEqual([...DEF.topics.filter((t) => t.fact != null).map((t) => t.fact), DEF.words.siteFact])
    expect(facts.querySelectorAll('b [role="textbox"]')).toHaveLength(0)

    type(field(`The name of the fact for ${TERM.label}`), 'A made-up fact')
    expect(onWords).toHaveBeenLastCalledWith(`topic.${TERM.key}.fact`, 'A made-up fact')
    type(field('The name of the fact that counts what the site must have'), 'A made-up count')
    expect(onWords).toHaveBeenLastCalledWith('words.siteFact', 'A made-up count')
  })

  it('makes the basis page’s line a field only while the paper is Off', () => {
    const onWords = edit()
    press('Next: The basis')
    expect(screen.queryByRole('textbox', { name: 'What the basis page says when the paper is Off' })).toBeNull()
    expect(screen.getByText('Every page is on Standard.')).toBeTruthy()
    slide(0)
    const off = field('What the basis page says when the paper is Off')
    expect(off.textContent).toBe(DEF.words.offSays)
    type(off, 'A made-up Off line.')
    expect(onWords).toHaveBeenLastCalledWith('words.offSays', 'A made-up Off line.')
  })

  it('makes the last press’s words and the line under it fields, and the press reads what is typed', () => {
    const onWords = edit()
    press('Step 11: Review')
    const words = field('The words on the last press')
    expect(words.textContent).toBe(DEF.words.confirmPress)
    expect(field('The line under the last press').textContent).toBe(DEF.words.beforeConfirm)
    type(words, 'A made-up press')
    expect(onWords).toHaveBeenLastCalledWith('words.confirmPress', 'A made-up press')
    expect(screen.getByRole('button', { name: 'A made-up press' })).toBeTruthy()
    type(field('The line under the last press'), 'A made-up line.')
    expect(onWords).toHaveBeenLastCalledWith('words.beforeConfirm', 'A made-up line.')

    // Pressed, the line is a count of who was asked: the flow works it out, so it is no field.
    press('A made-up press')
    expect(screen.queryByRole('textbox', { name: 'The line under the last press' })).toBeNull()
    expect(screen.getByText(/^Required\. /)).toBeTruthy()
  })

  it('makes the Off paper’s last press and its line fields too', () => {
    const onWords = edit()
    press('Next: The basis')
    slide(0)
    press('Next: Review')
    expect(field('The words on the last press').textContent).toBe(DEF.words.nothingPress)
    type(field('The line under the last press'), 'A made-up reason.')
    expect(onWords).toHaveBeenLastCalledWith('words.offNote', 'A made-up reason.')
    expect((screen.getByRole('button', { name: DEF.words.nothingPress }) as HTMLButtonElement).disabled).toBe(true)
  })
})

describe('the same words, for anyone who walks the flow', () => {
  it('draws no field: a GC’s view and a look-only link read plain words', () => {
    for (const look of [undefined, { lastStep: 'You can look. Nothing is sent.' }]) {
      render(<DocumentBuilderFlow def={DEF} look={look} />)
      fireEvent.click(screen.getByRole('checkbox', { name: 'I have read this.' }))
      press('Next: The basis')
      expect(screen.getByText(DEF.words.siteFact)).toBeTruthy()
      press('Step 4: Photos and video')
      expect(screen.getByText(PHOTOS.section)).toBeTruthy()
      press('Step 11: Review')
      expect(screen.queryAllByRole('textbox')).toEqual([])
      cleanup()
    }
  })

  it('draws no field on a host’s own press, whatever the paper says', () => {
    render(<DocumentBuilderFlow def={DEF} host={{ start: { ackAt: '2026-11-20T15:00:00.000Z', step: 10 }, confirm: { label: 'A host press', note: 'A host line.' } }} />)
    expect(screen.getByRole('button', { name: 'A host press' })).toBeTruthy()
    expect(screen.getByText('A host line.')).toBeTruthy()
    expect(screen.queryAllByRole('textbox')).toEqual([])
  })
})
