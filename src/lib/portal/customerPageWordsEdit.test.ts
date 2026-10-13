// Settings → Customer page (Messages cut 8d): every sentence of ours by where it shows, the office's change laid over the
// code's, and the table's own rules said before the press.
import { describe, expect, it } from 'vitest'
import { blanksOf, customerPageWordGroups, findWordLines, PAPER_PARTS, WORD_PLACES, wordEditProblem, type SavedWord, type WordLine } from './customerPageWordsEdit'
import { customerPageWordRows } from './pageWords'

const seeded = (): SavedWord[] => customerPageWordRows().map((r) => ({ key: r.key, en: r.en, es: r.es, editedAt: null, editedBy: null }))
const lineOf = (groups: ReturnType<typeof customerPageWordGroups>, key: string): WordLine => {
  const line = groups.flatMap((g) => g.lines).find((l) => l.key === key)
  if (!line) throw new Error(`no line ${key}`)
  return line
}

describe('every sentence of ours, by where it shows', () => {
  it('holds each sentence once, in the order of the page, its places first and each paper after', () => {
    const groups = customerPageWordGroups(seeded())
    expect(groups.flatMap((g) => g.lines.map((l) => l.key)).sort()).toEqual(customerPageWordRows().map((r) => r.key).sort())
    expect(groups.map((g) => g.title)).toEqual([
      ...WORD_PLACES.map((p) => p.title),
      'The paper: Master agreement',
      'The paper: Our bid',
      'The paper: Our contract',
      'The paper: Start date letter',
      'The paper: Pay application',
      'The paper: Change order',
    ])
    expect(groups[0]?.lines.map((l) => l.key)).toEqual(['switchLang', 'offThanks'])
    expect(groups.find((g) => g.title === 'Schedule')?.lines.map((l) => l.key)).toContain('reasonWeather')
  })

  it('starts each place at a sentence the page has, in the page’s order', () => {
    const keys = customerPageWordRows().map((r) => r.key)
    const at = WORD_PLACES.map((p) => keys.indexOf(p.from))
    expect(at.every((i) => i >= 0)).toBe(true)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
  })

  it('names each part of a paper in the office’s words', () => {
    const contract = customerPageWordGroups(seeded()).find((g) => g.title === 'The paper: Our contract')
    expect(contract?.lines.map((l) => l.part)).toEqual(contract?.lines.map((l) => PAPER_PARTS[l.key.split('.')[2] ?? ''] ?? null))
    expect(contract?.lines.find((l) => l.key === 'paper.contract.button')?.part).toBe('Its button')
  })

  it('lays the office’s change over the code’s words, with who and when', () => {
    const saved = seeded().map((w) =>
      w.key === 'nothingToday' ? { ...w, en: 'Nothing needed from you today.', es: 'Hoy no le pedimos nada.', editedAt: '2026-10-12T15:00:00Z', editedBy: 'Rosa' } : w,
    )
    const line = lineOf(customerPageWordGroups(saved), 'nothingToday')
    expect(line.now).toEqual({ en: 'Nothing needed from you today.', es: 'Hoy no le pedimos nada.' })
    expect(line.code.en).toBe('Nothing from you today.')
    expect(line.changed).toEqual({ by: 'Rosa', at: '2026-10-12T15:00:00Z' })
    expect(lineOf(customerPageWordGroups(saved), 'fewer').changed).toBeNull()
  })

  it('reads a sentence the table does not hold yet as the code’s, and holds it until the update brings it', () => {
    const line = lineOf(customerPageWordGroups(seeded().filter((w) => w.key !== 'seePhotos')), 'seePhotos')
    expect(line).toMatchObject({ saved: false, now: { en: 'See this week’s photos' }, changed: null })
    expect(wordEditProblem(line, 'See the photos', 'Vea las fotos')).toBe('This sentence comes with the next update. It can change once it is here.')
  })
})

describe('the table’s rules, before the press', () => {
  const groups = customerPageWordGroups(seeded())
  const weAreOn = lineOf(groups, 'weAreOn')
  const fewer = lineOf(groups, 'fewer')

  it('reads the blanks the page fills in, each once', () => {
    expect(weAreOn.blanks).toEqual(['step'])
    expect(blanksOf('{a} and {b} then {a}')).toEqual(['a', 'b'])
    expect(fewer.blanks).toEqual([])
  })

  it('saves a change that keeps its blanks in both languages', () => {
    expect(wordEditProblem(weAreOn, 'Right now we are on {step}.', 'Ahora estamos en {step}.')).toBeNull()
  })

  it('says why a change cannot be saved', () => {
    expect(wordEditProblem(weAreOn, 'Right now we are on {step}.', '  ')).toBe('Write it in English and in Spanish.')
    expect(wordEditProblem(weAreOn, `${'x'.repeat(401)} {step}`, 'Estamos en {step}.')).toBe('Keep each one to 400 characters.')
    expect(wordEditProblem(weAreOn, 'Right now we are on it.', 'Ahora estamos en {step}.')).toBe('The English keeps {step} as written. The page fills it in.')
    expect(wordEditProblem(weAreOn, 'We are on {step}.', 'Estamos en {paso}.')).toBe('The Spanish keeps {step} as written. The page fills it in.')
    expect(wordEditProblem(fewer, 'Fewer {steps}', 'Menos')).toBe('The English has nothing for the page to fill in. Take out the words in braces.')
  })
})

describe('finding a sentence', () => {
  const groups = customerPageWordGroups(seeded())

  it('finds a sentence by words in either language, every word of the search', () => {
    expect(findWordLines(groups, 'nothing today').flatMap((g) => g.lines.map((l) => l.key))).toContain('nothingToday')
    expect(findWordLines(groups, 'Hoy necesitamos').flatMap((g) => g.lines.map((l) => l.key))).toContain('nothingToday')
    expect(findWordLines(groups, 'nothing zebra')).toEqual([])
  })

  it('keeps every group when nothing is searched', () => {
    expect(findWordLines(groups, '  ')).toEqual(groups)
  })
})
