/**
 * Every press on the Months card is a thumb's target on a phone (v2.8119, the owner's pick of 2026-11-20 on the audit of
 * punch list #361). A layout is a browser's to measure, so this holds the rules the measure rests on, inside the narrow
 * card's block of `index.css`: 44 px on every button and link, the margin that lets a press of words keep its line, the
 * bordered presses left at their own height, and the room that keeps two quiet rows' touch areas apart.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8')
const narrow = css.slice(css.indexOf('@container lien-months (max-width: 560px)'))
const block = narrow.slice(0, narrow.indexOf('\n}\n'))

describe('the Months card’s presses on a narrow card (v2.8119)', () => {
  it('makes every button and link 44 px tall, as the tick is', () => {
    expect(block).toMatch(/\.lienLedger button, \.lienLedger a \{[^}]*min-height: 44px;[^}]*\}/)
    expect(block).toMatch(/\.lienLedgerTick \{[^}]*min-width: 44px; min-height: 44px;[^}]*\}/)
  })

  it('lets a press of words keep its line, and a press with an edge stand at its own height', () => {
    expect(block).toMatch(/\.lienLedger button:not\(\.lienLedgerNoteMissed\), \.lienLedger a \{ margin-block: -13px; margin-block: calc\(\(1lh - 44px\) \/ 2\); \}/)
    expect(block).toMatch(/\.lienLedger \[data-lien-claim-editor\] button, \.lienLedger \[data-testid='lien-last-work-editor'\] button \{ margin-block: 0; \}/)
  })

  it('gives a quiet row with a press the room of a 44 px row, so two such rows do not overlap', () => {
    expect(block).toMatch(/\.lienLedgerQuiet:has\(button, a\) \{ padding-top: 13px; padding-bottom: 13px; \}/)
  })

  it('leaves a desk as it was: none of it is outside the narrow card', () => {
    const outside = css.replace(block, '')
    expect(outside).not.toMatch(/\.lienLedger button, \.lienLedger a \{/)
  })
})
