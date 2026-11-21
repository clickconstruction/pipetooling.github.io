/**
 * The lines a settings list holds beside a choice (punch list #389, step 4): what puts a person in breach, what the
 * site must have, and the notice and the site note the office's settings page opens on. The list keeps them, tidies
 * them when it is saved, and a list written before step 4 reads and writes exactly as it did. Every word here is a
 * made-up placeholder.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { PAPER_SETTINGS_LIMITS, choiceLines, parseSettingsDef, settingsDefJson, settingsDefProblems, tidyLines, type SettingChoice, type SettingsDef } from './paperSettings'

const OLD = {
  settings: [
    { key: 'photos', label: 'Photos and video', choices: [
      { key: 'off', label: 'Off', says: 'A placeholder line.', out: true },
      { key: 'standard', label: 'Standard', says: 'A placeholder line.' },
    ] },
  ],
  fields: [],
  levels: [{ key: 'standard', label: 'Standard', alignedWith: 'Aligned with a placeholder place', picks: { photos: 'standard' } }],
}
const WITH_LINES = {
  ...OLD,
  settings: [
    { key: 'photos', label: 'Photos and video', choices: [
      { key: 'off', label: 'Off', says: 'A placeholder line.', out: true },
      { key: 'standard', label: 'Standard', says: 'A placeholder line.', breach: ['Breach one.', 'Breach two.'], site: ['Site one.'], breachEs: ['Falta uno.'] },
    ] },
  ],
  notice: { title: 'Before you start', tick: 'I have read this.', lines: ['Notice one.', 'Notice two.'] },
  siteNote: { title: 'Match the paper to the site', lead: 'A placeholder lead.', lines: ['Site note one.'] },
}
const def = parseSettingsDef(WITH_LINES) as SettingsDef
const standard = def.settings[0]!.choices[1]!

describe('a list written before step 4', () => {
  it('reads with none of the new keys, and writes exactly as it was', () => {
    const old = parseSettingsDef(OLD) as SettingsDef
    expect(Object.keys(old)).toEqual(['settings', 'fields', 'levels'])
    for (const c of old.settings[0]!.choices) expect(Object.keys(c)).toEqual(['key', 'label', 'labelEs', 'says', 'saysEs', 'out', 'fills', 'fillsEs'])
    expect(settingsDefJson(old)).toEqual(OLD)
    expect(settingsDefProblems(old)).toEqual([])
  })
})

describe('a list with lines', () => {
  it('keeps a choice’s breach and site lines, and the two notes', () => {
    expect(standard.breach).toEqual(['Breach one.', 'Breach two.'])
    expect(standard.site).toEqual(['Site one.'])
    expect(standard.breachEs).toEqual(['Falta uno.'])
    expect(standard.siteEs).toBeUndefined()
    expect(def.notice).toMatchObject({ title: 'Before you start', tick: 'I have read this.', lines: ['Notice one.', 'Notice two.'] })
    expect(def.siteNote).toMatchObject({ title: 'Match the paper to the site', lead: 'A placeholder lead.', lines: ['Site note one.'] })
    expect(settingsDefProblems(def)).toEqual([])
  })

  it('writes back what it read', () => {
    expect(settingsDefJson(def)).toEqual(WITH_LINES)
    expect(parseSettingsDef(settingsDefJson(def))).toEqual(def)
  })

  it('reads lines that are not plain lines as none', () => {
    const odd = parseSettingsDef({ ...OLD, settings: [{ key: 'photos', label: 'Photos', choices: [{ key: 'a', label: 'A', says: 'x', breach: 'one line', site: [1, null, ' Site. ', ''] }, { key: 'b', label: 'B', says: 'x' }] }], notice: [], siteNote: { title: 'No lines' } }) as SettingsDef
    expect(odd.settings[0]!.choices[0]!.breach).toBeUndefined()
    expect(odd.settings[0]!.choices[0]!.site).toEqual(['Site.'])
    expect(odd.notice).toBeUndefined()
    expect(odd.siteNote).toBeUndefined()
  })
})

describe('while a person types', () => {
  const typing = (over: Partial<SettingChoice>): SettingsDef => ({ ...def, settings: [{ ...def.settings[0]!, choices: [def.settings[0]!.choices[0]!, { ...standard, ...over }] }] })

  it('an empty line stays in the list, and is left out when the list is saved', () => {
    const d = typing({ breach: ['Breach one.', '', '  Breach three.  ', ''] })
    expect(d.settings[0]!.choices[1]!.breach).toHaveLength(4)
    const saved = settingsDefJson(d) as { settings: Array<{ choices: Array<Record<string, unknown>> }> }
    expect(saved.settings[0]!.choices[1]!.breach).toEqual(['Breach one.', 'Breach three.'])
    expect(tidyLines(['', '  ', ' a '])).toEqual(['a'])
  })

  it('a choice with every line cleared writes no list at all', () => {
    const saved = settingsDefJson(typing({ breach: [''], site: [], breachEs: ['  '] })) as { settings: Array<{ choices: Array<Record<string, unknown>> }> }
    expect(Object.keys(saved.settings[0]!.choices[1]!)).toEqual(['key', 'label', 'says'])
  })

  it('a note with its lines cleared is no note', () => {
    const saved = settingsDefJson({ ...def, notice: { ...def.notice!, lines: ['', ' '] } })
    expect('notice' in saved).toBe(false)
    expect('siteNote' in saved).toBe(true)
  })
})

describe('choiceLines', () => {
  it('shows the English where the Spanish is empty', () => {
    expect(choiceLines(standard, 'breach', 'en')).toEqual(['Breach one.', 'Breach two.'])
    expect(choiceLines(standard, 'breach', 'es')).toEqual(['Falta uno.'])
    expect(choiceLines(standard, 'site', 'es')).toEqual(['Site one.'])
    expect(choiceLines(def.settings[0]!.choices[0]!, 'site', 'en')).toEqual([])
  })
})

describe('settingsDefProblems, the lines', () => {
  const L = PAPER_SETTINGS_LIMITS
  const many = (n: number) => Array.from({ length: n }, (_, i) => `Placeholder line ${i + 1}.`)

  it('holds a choice to twenty breach lines and twenty site lines', () => {
    const d: SettingsDef = { ...def, settings: [{ ...def.settings[0]!, choices: [def.settings[0]!.choices[0]!, { ...standard, breach: many(L.lines + 1), site: many(L.lines + 1) }] }] }
    expect(settingsDefProblems(d)).toEqual(['Photos and video, Standard, holds at most 20 breach lines.', 'Photos and video, Standard, holds at most 20 site lines.'])
    expect(settingsDefProblems({ ...def, settings: [{ ...def.settings[0]!, choices: [def.settings[0]!.choices[0]!, { ...standard, breach: [...many(L.lines), '', ''] }] }] })).toEqual([])
  })

  it('holds a note to twelve lines, and names one with words and no line', () => {
    expect(settingsDefProblems({ ...def, notice: { ...def.notice!, lines: many(L.noteLines + 1) } })).toEqual(['The notice holds at most 12 lines.'])
    expect(settingsDefProblems({ ...def, siteNote: { ...def.siteNote!, lines: [''] } })).toEqual(['The site note has words and no line. Add a line or clear its words.'])
  })

  it('holds a line to the same length as every other word', () => {
    const long = 'x'.repeat(L.words + 1)
    expect(settingsDefProblems({ ...def, notice: { ...def.notice!, lines: [long] } })).toEqual(['A name or a line holds at most 400 characters.'])
    expect(settingsDefProblems({ ...def, settings: [{ ...def.settings[0]!, choices: [def.settings[0]!.choices[0]!, { ...standard, site: [long] }] }] })).toEqual(['A name or a line holds at most 400 characters.'])
  })

  it('says each gap in plain words', () => {
    for (const words of ['Photos and video, Standard, holds at most 20 breach lines.', 'The notice holds at most 12 lines.', 'The site note has words and no line. Add a line or clear its words.']) expect(plainWordsFailures(words)).toEqual([])
  })
})

describe('the database’s own stop', () => {
  const GROUND = resolve(__dirname, '../../../supabase/migrations/20261121150000_settings_page_ground.sql')
  it('holds the same counts, once the ground is on main', () => {
    let sql = ''
    try {
      sql = readFileSync(GROUND, 'utf8')
    } catch {
      return // the ground's PR has not merged into this checkout yet
    }
    for (const key of ['breach', 'breachEs', 'site', 'siteEs']) expect(sql).toContain(`public.contract_paper_lines_bad(c.v -> '${key}', ${PAPER_SETTINGS_LIMITS.lines})`)
    for (const key of ['lines', 'linesEs']) expect(sql).toContain(`public.contract_paper_lines_bad(p_note -> '${key}', ${PAPER_SETTINGS_LIMITS.noteLines})`)
    expect(sql).toContain(`length(e.v #>> '{}') > ${PAPER_SETTINGS_LIMITS.words}`)
  })
})
