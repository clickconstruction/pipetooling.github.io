/**
 * The twin's proof (punch list #389, step 1): the cases in `supabase/tests/paper_settings/20_scenario.sql` run through
 * the database in the SQL bed and through `assemblePaper` here. One list of cases, so the Book's preview and the sign
 * page cannot drift. Every word in the cases is a made-up placeholder.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { assemblePaper, type Clause, type ContractPaper } from './assemble'
import { parseSettingsDef, settingsDefProblems, whenFromRow, type PaperPicks } from './paperSettings'

type CaseClause = { id: string; order: number; en: string; es: string; scope: string[]; slot: string | null; when: Record<string, string> | null }
type Case = { name: string; use: string[]; picks: PaperPicks | null; fields: Record<string, string> | null; trades: string[]; lang: 'en' | 'es'; problem: string | null; lines: string[]; exhibitFor: string[] }

const sql = readFileSync(resolve(__dirname, '../../../supabase/tests/paper_settings/20_scenario.sql'), 'utf8')
const json = sql.split('$cases$')[1]
if (!json) throw new Error('the cases are not between two $cases$ marks')
const bed = JSON.parse(json) as { def: unknown; clauses: CaseClause[]; cases: Case[] }
const def = parseSettingsDef(bed.def)

describe('the paper settings cases, through the kernel', () => {
  it('reads the bed’s settings list, and it keeps every rule', () => {
    expect(def).not.toBeNull()
    expect(def ? settingsDefProblems(def) : ['unread']).toEqual([])
    expect(bed.cases.length).toBeGreaterThan(10)
  })

  it.each(bed.cases.map((c) => [c.name, c] as const))('%s', (_name, c) => {
    const paper: ContractPaper = { id: 'paper', title: 'Settings bed paper (test)', name: 'the settings bed paper', between: '{company}', revision: 1, publishedAt: null, settingsDef: def }
    const clauses: Clause[] = bed.clauses.map((r) => ({
      id: r.id,
      order: r.order,
      en: r.en,
      es: r.es,
      scope: r.scope.length === 1 && r.scope[0] === 'all' ? 'all' : r.scope,
      v: 1,
      retiredAt: c.use.includes(r.id) ? null : '2026-11-19T00:00:00.000Z',
      retiredBy: null,
      slot: r.slot,
      when: whenFromRow(r.when),
    }))
    const got = assemblePaper(paper, clauses, { company: 'Sample Sub LLC', trades: c.trades, job: null, lang: c.lang, picks: c.picks, fields: c.fields })
    expect(got.problem).toBe(c.problem)
    if (c.problem == null) {
      expect([...got.clauses, ...got.exhibit].map((x) => `${x.n} ${x.text}`)).toEqual(c.lines)
      expect(got.exhibitFor).toEqual(c.exhibitFor)
    }
  })
})
