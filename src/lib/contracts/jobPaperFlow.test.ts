/**
 * The office's settings page on a job (punch list #389, step 4), its kernel: a Contract Book entry's settings list as
 * the walked flow's paper, the flow's answer as a job's picks, a job's picks back on the sliders, the blanks the office
 * types, and what a change will do in words. Every word in the list is a made-up placeholder.
 */
import { describe, expect, it } from 'vitest'
import { PAPER_OFF, breachGroups, flowSteps, levelFacts, paperStops, siteAsks, startSettings, topicFloor, withTopic } from '../documentBuilder/documentBuilder'
import { plainWordsFailures } from '../plainWords'
import { JOB_FLOW_WORDS, blanksMissing, blanksToType, changeWords, flowDefFromBook, flowFromPicks, flowUnfit, hasNotice, picksFromFlow, stopOfPick } from './jobPaperFlow'
import { parseSettingsDef, picksProblem, type SettingsDef } from './paperSettings'

const RAW = {
  settings: [
    { key: 'photos', label: 'Photos and video', labelEs: 'Fotos y video', choices: [
      { key: 'off', label: 'Off', says: 'No photo rule.', out: true },
      { key: 'ask', label: 'Ask first', says: 'Ask before a photo.', breach: ['A photo with no leave.'], site: ['A sign at the gate.'] },
      { key: 'none', label: 'None', says: 'No photos at all.', saysEs: 'Ninguna foto.', breach: ['A photo with no leave.', 'A camera on site.'], site: ['A sign at the gate.', 'A locker for phones.'], breachEs: ['Una foto sin permiso.'] },
    ] },
    { key: 'term', label: 'How long secrecy lasts', choices: [
      { key: 'short', label: 'Short', says: 'One year.', fills: { term_words: 'one year' }, fillsEs: { term_words: 'un año' } },
      { key: 'long', label: 'Long', says: 'Three years.', fills: { term_words: 'three years' } },
    ] },
  ],
  fields: [{ key: 'term_words', label: 'Secrecy lasts' }, { key: 'party', label: 'The protected party' }],
  levels: [
    { key: 'standard', label: 'Standard', alignedWith: 'Aligned with a placeholder place', picks: { photos: 'ask', term: 'short' } },
    { key: 'elevated', label: 'Elevated', alignedWith: 'Aligned with another placeholder place', picks: { photos: 'none', term: 'short' } },
    { key: 'strict', label: 'Strict', alignedWith: 'Aligned with a third placeholder place', picks: { photos: 'none', term: 'long' } },
  ],
  notice: { title: 'Read this first', tick: 'I have read it.', lines: ['Notice one.', 'Notice two.'] },
  siteNote: { title: 'What the site can hold', lead: 'A placeholder lead.', lines: ['Site note one.'] },
}
const def = parseSettingsDef(RAW) as SettingsDef
const ABOUT = { paperId: 'p1', title: 'Sample paper', job: 'J900' }
const flow = flowDefFromBook(def, ABOUT)

describe('flowDefFromBook', () => {
  it('makes the flow’s paper: the levels, a topic a setting, and the steps of the walk', () => {
    expect(flowUnfit(def)).toBeNull()
    expect(flow.levels).toEqual([
      { id: 'standard', name: 'Standard', alignedWith: 'Aligned with a placeholder place' },
      { id: 'elevated', name: 'Elevated', alignedWith: 'Aligned with another placeholder place' },
      { id: 'strict', name: 'Strict', alignedWith: 'Aligned with a third placeholder place' },
    ])
    expect(paperStops(flow)).toEqual([PAPER_OFF, 'standard', 'elevated', 'strict'])
    expect(flowSteps(flow).map((s) => s.name)).toEqual(['Before you start', 'The basis', 'Match the paper to the site', 'Photos and video', 'How long secrecy lasts', 'Review'])
    expect(flow.title).toBe('Sample paper')
    expect(flow.job).toBe('J900')
  })

  it('a level’s stop on a topic is the choice that level picks, with the lines the Book keeps beside it', () => {
    const photos = flow.topics[0]!
    expect(photos.levels.standard).toEqual({ says: 'Ask before a photo.', breach: ['A photo with no leave.'], site: ['A sign at the gate.'] })
    expect(photos.levels.elevated).toEqual(photos.levels.strict)
    expect(breachGroups(flow, 'photos', 'elevated')).toEqual({ own: ['A camera on site.'], carried: ['A photo with no leave.'], newAt: 'Elevated' })
    expect(siteAsks(flow, 'elevated')).toEqual([{ key: 'photos', label: 'Photos and video', lines: ['A sign at the gate.', 'A locker for phones.'] }])
  })

  it('a setting with a choice that leaves the topic out has Off, and one with none is in every paper', () => {
    const [photos, term] = flow.topics
    expect(photos!.inEveryPaper).toBe(false)
    expect(photos!.offSays).toBe('No photo rule.')
    expect(topicFloor(photos!)).toBe(0)
    expect(term!.inEveryPaper).toBe(true)
    expect(term!.offSays).toBeUndefined()
    expect(topicFloor(term!)).toBe(1)
  })

  it('a setting whose every choice fills one blank reads as a fact on the basis page', () => {
    expect(flow.topics[1]!.fact).toBe('Secrecy lasts')
    expect(flow.topics[1]!.levels.strict!.blank).toBe('three years')
    expect(flow.topics[0]!.fact).toBeUndefined()
    expect(levelFacts(flow, 'strict')).toEqual([
      { key: 'term', label: 'Secrecy lasts', value: 'three years' },
      { key: 'site', label: 'The site must have', value: '2 things' },
    ])
  })

  it('opens on the list’s notice and site note, and on the app’s own titles when the list has none', () => {
    expect(flow.notice).toEqual({ title: 'Read this first', lines: ['Notice one.', 'Notice two.'], placeholder: '', tick: 'I have read it.' })
    expect(flow.site).toMatchObject({ title: 'What the site can hold', lead: 'A placeholder lead.', lines: ['Site note one.'] })
    expect(hasNotice(def)).toBe(true)
    const bare = flowDefFromBook({ ...def, notice: undefined, siteNote: undefined }, ABOUT)
    expect(bare.notice).toEqual({ title: JOB_FLOW_WORDS.noticeTitle, lines: [], placeholder: '', tick: JOB_FLOW_WORDS.noticeTick })
    expect(bare.site.title).toBe(JOB_FLOW_WORDS.siteTitle)
    expect(hasNotice({ ...def, notice: undefined })).toBe(false)
  })

  it('reads in Spanish where the list has it, and in English where it does not', () => {
    const spanish = flowDefFromBook(def, ABOUT, 'es')
    expect(spanish.topics[0]!.label).toBe('Fotos y video')
    expect(spanish.topics[0]!.levels.elevated).toMatchObject({ says: 'Ninguna foto.', breach: ['Una foto sin permiso.'], site: ['A sign at the gate.', 'A locker for phones.'] })
    expect(spanish.topics[1]!.levels.standard!.blank).toBe('un año')
    expect(spanish.topics[1]!.levels.strict!.blank).toBe('three years')
  })

  it('a list with no levels is set on one page', () => {
    expect(flowUnfit({ ...def, levels: [] })).toBe(JOB_FLOW_WORDS.noLevels)
    expect(flowFromPicks({ ...def, levels: [] }, { photos: 'ask', term: 'short' }, null)).toBeNull()
  })
})

describe('picksFromFlow', () => {
  it('reads the basis as its level’s picks', () => {
    const s = startSettings(flow)
    expect(s.basis).toBe('standard')
    expect(picksFromFlow(def, s)).toEqual({ photos: 'ask', term: 'short' })
    expect(picksProblem(def, picksFromFlow(def, s))).toBeNull()
  })

  it('reads a page moved off the basis, and Off as the choice that leaves the topic out', () => {
    const s = startSettings(flow)
    expect(picksFromFlow(def, withTopic(flow, s, 'term', 'strict'))).toEqual({ photos: 'ask', term: 'long' })
    expect(picksFromFlow(def, withTopic(flow, s, 'photos', PAPER_OFF))).toEqual({ photos: 'off', term: 'short' })
  })

  it('answers nothing for a paper that is off, or a stop with no choice behind it', () => {
    expect(picksFromFlow(def, { ...startSettings(flow), off: true })).toBeNull()
    expect(picksFromFlow(def, { off: false, basis: 'standard', topics: { photos: 'standard', term: PAPER_OFF } })).toBeNull()
    expect(picksFromFlow(def, { off: false, basis: 'nowhere', topics: {} })).toBeNull()
  })
})

describe('flowFromPicks', () => {
  it('puts a job’s picks back on the sliders, from its basis', () => {
    expect(flowFromPicks(def, { photos: 'none', term: 'short' }, 'elevated')).toEqual({ off: false, basis: 'elevated', topics: { photos: 'elevated', term: 'elevated' } })
    expect(flowFromPicks(def, { photos: 'off', term: 'long' }, 'standard')).toEqual({ off: false, basis: 'standard', topics: { photos: PAPER_OFF, term: 'strict' } })
  })

  it('a choice two levels share sits on the basis when the basis is one of them, else on the looser', () => {
    const photos = def.settings[0]!
    expect(stopOfPick(def, photos, 'none', 'strict')).toBe('strict')
    expect(stopOfPick(def, photos, 'none', 'standard')).toBe('elevated')
    expect(stopOfPick(def, photos, 'none', null)).toBe('elevated')
    expect(stopOfPick(def, photos, 'gone', null)).toBeNull()
  })

  it('with no basis kept, the basis is the level most topics sit on, the loosest on a tie', () => {
    expect(flowFromPicks(def, { photos: 'ask', term: 'short' }, null)?.basis).toBe('standard')
    expect(flowFromPicks(def, { photos: 'none', term: 'short' }, 'gone')).toEqual({ off: false, basis: 'standard', topics: { photos: 'elevated', term: 'standard' } })
  })

  it('goes round: what the flow answered is what the sliders show again', () => {
    for (const s of [startSettings(flow), withTopic(flow, startSettings(flow), 'photos', PAPER_OFF), withTopic(flow, { off: false, basis: 'strict', topics: { photos: 'strict', term: 'strict' } }, 'term', 'standard')]) {
      const picks = picksFromFlow(def, s)!
      expect(picksFromFlow(def, flowFromPicks(def, picks, s.basis)!)).toEqual(picks)
    }
  })

  it('answers nothing for a pick no level holds', () => {
    const odd = parseSettingsDef({ ...RAW, levels: [RAW.levels[0]] }) as SettingsDef
    expect(flowFromPicks(odd, { photos: 'none', term: 'short' }, 'standard')).toBeNull()
  })
})

describe('the blanks the office types', () => {
  it('are the ones no picked choice fills', () => {
    expect(blanksToType(def, { photos: 'ask', term: 'short' }).map((f) => f.key)).toEqual(['party'])
    expect(blanksToType(def, null)).toEqual([])
    expect(blanksMissing(def, { photos: 'ask', term: 'short' }, {})).toEqual(['The protected party'])
    expect(blanksMissing(def, { photos: 'ask', term: 'short' }, { party: '  ' })).toEqual(['The protected party'])
    expect(blanksMissing(def, { photos: 'ask', term: 'short' }, { party: 'Ridgeway Sample Holdings' })).toEqual([])
  })
})

describe('changeWords', () => {
  it('holds the press while nothing is changed, and says a refusal in its own words', () => {
    expect(changeWords({ kind: 'nothing', change: 'same', words: 'Nothing changed.' })).toEqual({ press: 'Save the settings', dead: true, lines: ['Nothing is changed yet.'] })
    expect(changeWords({ kind: 'refused', change: 'same', words: 'Pick Photos and video.' })).toEqual({ press: 'Save the settings', dead: true, lines: ['Pick Photos and video.'] })
  })

  it('before any signature, saves in place and says nobody signs again', () => {
    expect(changeWords({ kind: 'saved', change: 'looser' })).toEqual({ press: 'Save the settings', dead: false, lines: ['This makes the paper looser.', 'Nobody has signed yet, so nobody signs again.'] })
  })

  it('after a signature, the press names how many sign again, whichever way the change goes', () => {
    expect(changeWords({ kind: 'revised', change: 'stricter', signAgain: 1 })).toEqual({
      press: 'Save, and ask 1 person to sign again',
      dead: false,
      lines: ['This makes the paper stricter.', '1 person has signed this paper. Each signs the new version again, and the job stays closed to each until then.'],
    })
    expect(changeWords({ kind: 'revised', change: 'looser', signAgain: 3 }).press).toBe('Save, and ask 3 people to sign again')
    expect(changeWords({ kind: 'revised', change: 'mixed', signAgain: 3 }).lines[0]).toBe('This makes the paper stricter on some topics and looser on others.')
    expect(changeWords({ kind: 'revised', change: 'same', signAgain: 2 }).lines[0]).toBe('No topic moves. The words of the paper changed.')
  })

  it('reads plainly', () => {
    const said = [...Object.values(JOB_FLOW_WORDS), ...changeWords({ kind: 'saved', change: 'mixed' }).lines, ...changeWords({ kind: 'revised', change: 'looser', signAgain: 3 }).lines, 'Nothing is changed yet.']
    for (const words of said) expect(plainWordsFailures(words)).toEqual([])
  })
})
