import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { COPPER, HAIR, MUTED, portalPressFill } from './portalTheme'

const SRC = resolve(__dirname, '../..')
// Built from pieces so the copper sweep, which rewrites the literal wherever it finds it, leaves this test be.
const OLD_COPPER = new RegExp(['#', 'b0662f'].join('') + '|\\b176, 102, 47\\b', 'i')

/** No file under src/ may carry the old copper: the pinned signing email and the two tests that read the email builders moved with them (punch list #199, the emails PR). */
const UNTIL_THE_EMAILS_MOVE: string[] = []

function filesWithOldCopper(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = resolve(dir, entry.name)
    if (entry.isDirectory()) filesWithOldCopper(p, out)
    else if (/\.(tsx?|css|json)$/.test(entry.name) && OLD_COPPER.test(readFileSync(p, 'utf8'))) out.push(p.slice(SRC.length + 1))
  }
  return out
}

describe('the copper (v2.6067)', () => {
  it('is one value: no file under src/ copies the old copper', () => {
    expect(filesWithOldCopper(SRC).sort()).toEqual(UNTIL_THE_EMAILS_MOVE)
  })

  it('a press that waits is muted words on the hairline; one that can be pressed is white on the copper', () => {
    expect(portalPressFill(true)).toEqual({ background: COPPER, color: '#fff' })
    expect(portalPressFill(false)).toEqual({ background: HAIR, color: MUTED })
  })
})
