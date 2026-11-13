import { describe, expect, it } from 'vitest'
import { docSections, sectionChangedWords, sectionFreshness, sectionFreshnessHeadWords, sectionNeedsALook, sectionNewerWords, sectionNumber } from './sectionFreshness'

/** Made-up text. Three versions of one narrative: v1 replaced Mar 1, v2 replaced Apr 1, then the text as it stands. */
const V1 = '## 1. Background\n\nJoined in March.\n\n## 2. The spring\n\nOne trip.'
const V2 = '## 1. Background\n\nJoined in March.\n\n## 2. The spring\n\nTwo trips.'
const NOW = 'Kept by the office.\n\n## 1. Background\n\nJoined   in\nMarch.\n\n## 2. The spring\n\nTwo trips.\n\n## 3. After\n\nQuiet.\n\n```\n## not a heading\n```'
const REVISIONS = [
  { content: V1, replaced_at: '2026-03-01T15:00:00Z' },
  { content: V2, replaced_at: '2026-04-01T15:00:00Z' },
]
const ymdOf = (iso: string) => iso.slice(0, 10)

describe('docSections', () => {
  it('splits by heading, keeps the words above the first one, and reads a fenced # as words', () => {
    const s = docSections(NOW)
    expect(s.map((x) => [x.key, x.level])).toEqual([['', 0], ['1. background', 2], ['2. the spring', 2], ['3. after', 2]])
    expect(s[0]!.body).toBe('Kept by the office.')
    expect(s[3]!.body).toContain('## not a heading')
  })

  it('a heading written twice gets its own key, and a text with no words above the first heading has no such section', () => {
    expect(docSections('## Notes\n\na\n\n## Notes\n\nb').map((x) => x.key)).toEqual(['notes', 'notes#2'])
    expect(docSections('## Only\n\nx').map((x) => x.key)).toEqual(['only'])
    expect(docSections('')).toEqual([])
  })

  it('reads the number a heading carries as the citations do', () => {
    expect(sectionNumber('16. Bidding conduct')).toBe(16)
    expect(sectionNumber('§3 The shop')).toBe(3)
    expect(sectionNumber('Appendix A')).toBeNull()
  })
})

describe('sectionFreshness', () => {
  const entries = [
    { created_at: '2026-02-15T12:00:00Z', cites: [1] },
    { created_at: '2026-03-10T12:00:00Z', cites: [2] },
    { created_at: '2026-04-20T12:00:00Z', cites: [2, 3] },
    { created_at: '2026-05-02T12:00:00Z' },
  ]
  const rows = sectionFreshness({ content: NOW, updatedAt: '2026-04-01T15:00:00Z', revisions: REVISIONS, entries })
  const by = (key: string) => rows.find((r) => r.key === key)!

  it('a section that reads the same in every version is older than the oldest version read', () => {
    // Section 1 was reflowed, not reworded: spacing alone is not a change.
    expect(by('1. background')).toMatchObject({ changedAt: '2026-03-01T15:00:00Z', atLeast: true, newerEntries: 3, newerCiting: 0 })
    expect(sectionChangedWords(by('1. background'), ymdOf)).toBe('not changed since before Mar 1, 2026')
    expect(sectionNewerWords(by('1. background'))).toBe('at least 3 entries since')
  })

  it('a section took its words when the newest version that reads differently was replaced', () => {
    // Section 2 reads "Two trips" in v2 and now, "One trip" in v1: it changed when v1 was replaced.
    expect(by('2. the spring')).toMatchObject({ changedAt: '2026-03-01T15:00:00Z', atLeast: false, newerEntries: 3, newerCiting: 2 })
    expect(sectionChangedWords(by('2. the spring'), ymdOf)).toBe('changed Mar 1, 2026')
    expect(sectionNewerWords(by('2. the spring'))).toBe('3 entries since, 2 cite it')
    expect(sectionNeedsALook(by('2. the spring'))).toBe(true)
  })

  it('a section no prior version holds is as new as the text itself', () => {
    expect(by('3. after')).toMatchObject({ changedAt: '2026-04-01T15:00:00Z', atLeast: false, newerEntries: 2, newerCiting: 1 })
    expect(sectionNewerWords(by('3. after'))).toBe('2 entries since, 1 cites it')
    expect(by('')).toMatchObject({ heading: '', level: 0, changedAt: '2026-04-01T15:00:00Z', atLeast: false })
  })

  it('revisions may come in any order, and the head line counts the sections to look at again', () => {
    const shuffled = sectionFreshness({ content: NOW, updatedAt: '2026-04-01T15:00:00Z', revisions: [...REVISIONS].reverse(), entries })
    expect(shuffled).toEqual(rows)
    expect(sectionFreshnessHeadWords(rows)).toBe('4 sections · 2 cited by entries written since they last changed')
    expect(sectionFreshnessHeadWords(rows.slice(0, 2))).toBe('2 sections · none cited by an entry written since it last changed')
    expect(sectionFreshnessHeadWords([{ newerCiting: 1 }])).toBe('1 section · 1 cited by an entry written since it last changed')
  })

  it('a document written once dates every section from its own date, and one with no date says so', () => {
    const once = sectionFreshness({ content: V1, updatedAt: '2026-02-01T10:00:00Z', revisions: [], entries })
    expect(once.map((r) => [r.changedAt, r.atLeast, r.newerEntries])).toEqual([['2026-02-01T10:00:00Z', false, 4], ['2026-02-01T10:00:00Z', false, 4]])
    const undated = sectionFreshness({ content: V1, updatedAt: null, revisions: [], entries })
    expect(undated[0]).toMatchObject({ changedAt: null, newerEntries: 0 })
    expect(sectionChangedWords(undated[0]!, ymdOf)).toBe('no date on file')
    expect(sectionNewerWords(undated[0]!)).toBe('')
    expect(sectionNewerWords({ changedAt: 'x', atLeast: false, newerEntries: 0, newerCiting: 0 })).toBe('no entries since')
    expect(sectionNewerWords({ changedAt: 'x', atLeast: false, newerEntries: 1, newerCiting: 0 })).toBe('1 entry since')
  })
})
