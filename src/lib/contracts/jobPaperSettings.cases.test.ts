/**
 * The twin's proof (punch list #389, step 3): the cases in `supabase/tests/job_paper_settings/20_scenario.sql` run
 * through the database in the SQL bed and through the kernel here. One list of cases, so what a screen says a change
 * will do, the plain words a signed copy keeps and the seal cannot drift from the database's. Every word in the cases
 * is a made-up placeholder.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { webcrypto } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { paperSeal, picksChange, sealText, type PicksChange, type SealedPaper } from './jobPaperSettings'
import { parseSettingsDef, settingsDefProblems, type PaperPicks } from './paperSettings'
import { summaryLines } from './paperSummary'

type ChangeCase = { name: string; from: PaperPicks; to: PaperPicks; change: PicksChange }
type SaidCase = { name: string; picks: PaperPicks; lang: 'en' | 'es'; lines: string[] }
type SealCase = { name: string; sha256: string; paper: SealedPaper }

const sql = readFileSync(resolve(__dirname, '../../../supabase/tests/job_paper_settings/20_scenario.sql'), 'utf8')
const json = sql.split('$cases$')[1]
if (!json) throw new Error('the cases are not between two $cases$ marks')
const bed = JSON.parse(json) as { def: unknown; changes: ChangeCase[]; said: SaidCase[]; seals: SealCase[] }
const parsed = parseSettingsDef(bed.def)
if (!parsed) throw new Error('the bed’s settings list does not read')
const def = parsed
const subtle = webcrypto.subtle as unknown as SubtleCrypto

describe('the job paper settings cases, through the kernel', () => {
  it('reads the bed’s settings list, and it keeps every rule', () => {
    expect(settingsDefProblems(def)).toEqual([])
    expect(bed.changes.length).toBeGreaterThanOrEqual(10)
    expect(bed.said.length).toBeGreaterThanOrEqual(3)
    expect(bed.seals.length).toBeGreaterThanOrEqual(5)
  })

  it.each(bed.changes.map((c) => [c.name, c] as const))('change, %s', (_name, c) => {
    expect(picksChange(def, c.from, c.to)).toBe(c.change)
  })

  it.each(bed.said.map((c) => [c.name, c] as const))('said, %s', (_name, c) => {
    expect(summaryLines(def, c.picks, c.lang).map((l) => `${l.label} | ${l.choice} | ${l.says} | ${l.out ? 'out' : 'in'}`)).toEqual(c.lines)
  })

  it.each(bed.seals.map((c) => [c.name, c] as const))('seal, %s', async (_name, c) => {
    expect(c.sha256).toMatch(/^[0-9a-f]{64}$/)
    expect(await paperSeal(c.paper, subtle)).toBe(c.sha256)
  })

  it('seals the same for the same settings and clause versions, and differently when either changes', () => {
    const [a, again, pick, version] = bed.seals
    if (!a || !again || !pick || !version) throw new Error('the bed has fewer seals than this reads')
    expect(sealText(again.paper)).toBe(sealText(a.paper))
    expect(sealText(pick.paper)).not.toBe(sealText(a.paper))
    expect(sealText(version.paper)).not.toBe(sealText(a.paper))
    expect(new Set(bed.seals.map((s) => s.sha256)).size).toBe(bed.seals.length - 1)
  })
})
