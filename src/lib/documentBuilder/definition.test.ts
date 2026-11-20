import { describe, expect, it } from 'vitest'
import { paperDefProblems, paperDefTexts, parsePaperDef, readPaperDef } from './definition'
import type { PaperDef } from './documentBuilder'
import { SECRECY_PAPER_FIXTURE as DEF } from './secrecyPaper.fixture'

/** The fixture as the database hands it back: plain JSON, with nothing of its type left. */
const asStored = (def: PaperDef): unknown => JSON.parse(JSON.stringify(def))

/** A copy to break in one place. */
function broken(change: (def: PaperDef) => void): PaperDef {
  const copy = JSON.parse(JSON.stringify(DEF)) as PaperDef
  change(copy)
  return copy
}

describe('reading a definition out of the database', () => {
  it('reads the made-up paper back whole', () => {
    const parsed = parsePaperDef(asStored(DEF))
    expect(parsed.ok).toBe(true)
    if (parsed.ok) expect(parsed.def).toEqual(DEF)
  })

  it('says a value that is not a paper is not one', () => {
    for (const value of [null, undefined, 'words', 7, [], true]) {
      expect(parsePaperDef(value)).toEqual({ ok: false, problems: ['The contents are not a paper.'] })
    }
  })

  it('names every gap of an empty object in one pass, and hands back no definition', () => {
    const parsed = parsePaperDef({})
    expect(parsed.ok).toBe(false)
    if (parsed.ok) return
    expect(parsed.problems).toContain('The paper has no words.')
    expect(parsed.problems).toContain('The paper has no list of levels.')
    expect(parsed.problems).toContain('The paper has no list of topics.')
    expect(parsed.problems).toContain('The paper has no title.')
    expect(parsed.problems).toContain('The disclaimer has no tick.')
    expect(parsed.problems.length).toBeGreaterThan(10)
  })

  it('names the topic and the level a gap is in', () => {
    const stored = asStored(DEF) as { topics: Array<{ levels: Record<string, Record<string, unknown>> }> }
    delete stored.topics[0]?.levels.gov?.breach
    const parsed = parsePaperDef(stored)
    expect(parsed).toEqual({ ok: false, problems: ['Topic 1, Photos and video, at gov has no list of breach.'] })
  })

  it('refuses a level that is not an object, a line that is not words, and a signer group with no count', () => {
    const stored = asStored(DEF) as { levels: unknown[]; notice: { lines: unknown[] }; signers: unknown[] }
    stored.levels[1] = 'Elevated'
    stored.notice.lines[0] = 3
    stored.signers[0] = { group: 'Crew' }
    const parsed = parsePaperDef(stored)
    expect(parsed.ok).toBe(false)
    if (parsed.ok) return
    expect(parsed.problems).toEqual(expect.arrayContaining(['Level 2 is not a level.', 'The disclaimer has no list of lines.', 'Signer group 1 is not a group with a head count.']))
  })

  it('keeps a short name, a fact, a blank and what Off means only where they are set', () => {
    const parsed = parsePaperDef(asStored({ ...DEF, levels: DEF.levels.map((l, i) => (i === 0 ? { ...l, shortName: 'Std' } : l)) }))
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.def.levels[0]?.shortName).toBe('Std')
    expect('shortName' in (parsed.def.levels[1] ?? {})).toBe(false)
    expect(parsed.def.topics[4]?.fact).toBe('Secrecy lasts')
    expect('fact' in (parsed.def.topics[0] ?? {})).toBe(false)
    expect(parsed.def.topics[4]?.levels.std?.blank).toBe('3 years')
    expect('blank' in (parsed.def.topics[0]?.levels.std ?? {})).toBe(false)
  })
})

describe('the rules a definition keeps', () => {
  it('passes the made-up paper', () => {
    expect(paperDefProblems(DEF)).toEqual([])
    expect(readPaperDef(asStored(DEF)).ok).toBe(true)
  })

  it('needs a level, and no two levels on one id', () => {
    expect(paperDefProblems(broken((d) => void (d.levels = [])))).toContain('The paper has no level.')
    expect(paperDefProblems(broken((d) => void (d.levels[1] = { ...d.levels[1], id: 'std', name: 'Elevated', alignedWith: 'Aligned with banks' })))).toContain('Two levels share the id std.')
  })

  it('needs every topic to have every level and no other', () => {
    expect(paperDefProblems(broken((d) => void delete d.topics[0]?.levels.mid))).toEqual(['Photos and video has no Aggressive level.'])
    const extra = broken((d) => {
      const topic = d.topics[1]
      if (topic) topic.levels.top = { says: 'A made-up rule.', breach: ['Breaking the made-up rule.'], site: [] }
    })
    expect(paperDefProblems(extra)).toEqual(['Phones and devices has a level the paper does not have: top.'])
  })

  it('needs every level of a topic to say what it means and to have a breach line', () => {
    const quiet = broken((d) => {
      const at = d.topics[2]?.levels.gov
      if (at) at.says = '  '
    })
    expect(paperDefProblems(quiet)).toEqual(['Getting on site at Elevated does not say what it means.'])
    const none = broken((d) => {
      const at = d.topics[2]?.levels.gov
      if (at) at.breach = []
    })
    expect(paperDefProblems(none)).toEqual(['Getting on site at Elevated has no breach line.'])
    const empty = broken((d) => void d.topics[2]?.levels.gov?.site.push(''))
    expect(paperDefProblems(empty)).toEqual(['Getting on site at Elevated has an empty line.'])
  })

  it('needs a topic that can be left out to say what Off means', () => {
    expect(paperDefProblems(broken((d) => void delete d.topics[3]?.offSays))).toEqual(['Talking on site can be left out, and does not say what Off means.'])
    expect(paperDefProblems(broken((d) => void delete d.topics[4]?.offSays))).toEqual([])
  })

  it('needs no two topics on one key', () => {
    const twice = broken((d) => {
      const topic = d.topics[1]
      if (topic) topic.key = 'photos'
    })
    expect(paperDefProblems(twice)).toContain('Two topics share the key photos.')
  })

  it('holds every line to the plain-words rules, and says where the line is', () => {
    const glued = broken((d) => void d.topics[0]?.levels.std?.breach.push('Taking a photo (of anything) on site.'))
    const problems = paperDefProblems(glued)
    expect(problems).toHaveLength(1)
    expect(problems[0]).toMatch(/^Photos and video at Standard: glued/)
    const long = broken((d) => void (d.notice.lines[0] = 'This tool does not give legal advice and it never will give any legal advice to anyone who uses it on any job at any time of day.'))
    expect(paperDefProblems(long)[0]).toMatch(/^The disclaimer: 2\d words \(over 20\)/)
  })

  it('counts every piece of words the paper holds', () => {
    const texts = paperDefTexts(DEF)
    expect(texts.some((t) => t.where === 'Photos and video at Strict' && t.text === 'No photos or video at all.')).toBe(true)
    expect(texts.some((t) => t.where === 'The disclaimer' && t.text === 'I have read this.')).toBe(true)
    expect(texts.every((t) => t.text.length > 0)).toBe(true)
  })

  it('refuses what parses and still breaks a rule', () => {
    const parsed = readPaperDef(asStored(broken((d) => void delete d.topics[0]?.levels.mid)))
    expect(parsed).toEqual({ ok: false, problems: ['Photos and video has no Aggressive level.'] })
  })
})
