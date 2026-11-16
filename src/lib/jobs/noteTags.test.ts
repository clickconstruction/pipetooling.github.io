import { describe, expect, it } from 'vitest'
import {
  TAG_SECTION_SHOWN,
  canTagInJobNotes,
  insertPick,
  liveTags,
  mentionIndex,
  nameMatchesQuery,
  noteBodyParts,
  noteTagMark,
  oldestFirst,
  rankTaggable,
  removePick,
  sectionSplit,
  tagAgeDays,
  tagAgeWords,
  tagIsLate,
  tagQueryAtCaret,
  tagsByNote,
  waitingOnWords,
  workingDaysWaited,
  type NoteTagRow,
  type TaggablePerson,
} from './noteTags'

const person = (userId: string, name: string, onJob: boolean, role: string | null = null): TaggablePerson => ({
  userId,
  name,
  role,
  onJob,
})

const PEOPLE: TaggablePerson[] = [
  person('u-dana', 'Dana Whitlock', false, 'assistant'),
  person('u-bell', 'Chris Bell', false, 'assistant'),
  person('u-luis', 'Luis Ortega', true, 'superintendent'),
  person('u-alv', 'Chris Alvarez', true, 'helper'),
  person('u-marcus', 'Marcus Hale', false, 'master_technician'),
]

const names = (rows: ReturnType<typeof rankTaggable>) => rows.map((r) => `${r.group}:${r.person.name}`)

describe('tagQueryAtCaret', () => {
  it('finds the @ being typed at the end of the words', () => {
    expect(tagQueryAtCaret('meter date? @ch', 15)).toEqual({ query: 'ch', start: 12 })
  })

  it('opens on a bare @ at the start and after a space', () => {
    expect(tagQueryAtCaret('@', 1)).toEqual({ query: '', start: 0 })
    expect(tagQueryAtCaret('hold on @', 9)).toEqual({ query: '', start: 8 })
  })

  it('reads only up to the caret', () => {
    expect(tagQueryAtCaret('@da and more', 3)).toEqual({ query: 'da', start: 0 })
    expect(tagQueryAtCaret('@da and more', 12)).toBeNull()
  })

  it('stays shut for the @ that means at', () => {
    expect(tagQueryAtCaret('arrive @ 8:45', 13)).toBeNull()
    expect(tagQueryAtCaret('arrive @ ', 9)).toBeNull()
    expect(tagQueryAtCaret('materials @$300', 15)).toBeNull()
    expect(tagQueryAtCaret('materials @3', 12)).toBeNull()
  })

  it('stays shut inside an email address', () => {
    expect(tagQueryAtCaret('send to joe@ridge', 17)).toBeNull()
  })

  it('takes accents, an apostrophe and a hyphen in a name', () => {
    expect(tagQueryAtCaret("ask @O'Br", 9)?.query).toBe("O'Br")
    expect(tagQueryAtCaret('ask @José', 9)?.query).toBe('José')
    expect(tagQueryAtCaret('ask @Mary-A', 11)?.query).toBe('Mary-A')
  })

  it('clamps a caret past the end', () => {
    expect(tagQueryAtCaret('@lu', 99)).toEqual({ query: 'lu', start: 0 })
  })
})

describe('nameMatchesQuery', () => {
  it('matches the start of any word, in any case', () => {
    expect(nameMatchesQuery('Chris Bell', 'ch')).toBe(true)
    expect(nameMatchesQuery('Chris Bell', 'BE')).toBe(true)
    expect(nameMatchesQuery('Chris Bell', 'ell')).toBe(false)
  })

  it('matches everyone when nothing is typed', () => {
    expect(nameMatchesQuery('Dana Whitlock', '')).toBe(true)
  })

  it('ignores accents and splits a hyphenated name', () => {
    expect(nameMatchesQuery('José Peña', 'jose')).toBe(true)
    expect(nameMatchesQuery('José Peña', 'pena')).toBe(true)
    expect(nameMatchesQuery('Mary-Ann Cole', 'ann')).toBe(true)
  })
})

describe('rankTaggable', () => {
  it('puts the job crew first, then the office, each by name', () => {
    expect(names(rankTaggable(PEOPLE, ''))).toEqual([
      'job:Chris Alvarez',
      'job:Luis Ortega',
      'office:Chris Bell',
      'office:Dana Whitlock',
      'office:Marcus Hale',
    ])
  })

  it('narrows to the letters typed and keeps both people named Chris', () => {
    expect(names(rankTaggable(PEOPLE, 'ch'))).toEqual(['job:Chris Alvarez', 'office:Chris Bell'])
  })

  it('puts the person who asked on top of an answer box', () => {
    const rows = rankTaggable(PEOPLE, '', { askerId: 'u-marcus' })
    expect(names(rows)[0]).toBe('asked:Marcus Hale')
    expect(rows).toHaveLength(5)
  })

  it('leaves out people already picked and the writer', () => {
    const rows = rankTaggable(PEOPLE, '', { pickedIds: ['u-luis'], selfId: 'u-dana' })
    expect(names(rows)).toEqual(['job:Chris Alvarez', 'office:Chris Bell', 'office:Marcus Hale'])
  })

  it('drops a nameless row and a person listed twice', () => {
    const rows = rankTaggable([person('u-x', '  ', true), ...PEOPLE, person('u-luis', 'Luis Ortega', true)], 'lu')
    expect(names(rows)).toEqual(['job:Luis Ortega'])
  })

  it('is empty when nobody by that name can open the job', () => {
    expect(rankTaggable(PEOPLE, 'zed')).toEqual([])
  })
})

describe('insertPick', () => {
  it('turns the @ being typed into the full name and a space', () => {
    expect(insertPick('meter date? @ch', 15, 'Chris Bell')).toEqual({ text: 'meter date? @Chris Bell ', caret: 24 })
  })

  it('keeps the words after the caret, with one space between', () => {
    expect(insertPick('@da can you check', 3, 'Dana Whitlock')).toEqual({
      text: '@Dana Whitlock can you check',
      caret: 15,
    })
  })

  it('adds the name at the caret when no @ is being typed', () => {
    expect(insertPick('can you check', 13, 'Luis Ortega')).toEqual({ text: 'can you check @Luis Ortega ', caret: 27 })
    expect(insertPick('', 0, 'Luis Ortega')).toEqual({ text: '@Luis Ortega ', caret: 13 })
  })

  it('leaves a query the list can no longer read', () => {
    const next = insertPick('@lu', 3, 'Luis Ortega')
    expect(tagQueryAtCaret(next.text, next.caret)).toBeNull()
  })
})

describe('mentionIndex and liveTags', () => {
  it('finds a whole name after a space or at the start', () => {
    expect(mentionIndex('@Dana Whitlock can we?', 'Dana Whitlock')).toBe(0)
    expect(mentionIndex('ok @Dana Whitlock', 'Dana Whitlock')).toBe(3)
    expect(mentionIndex('ok @Dana Whitlock, thanks', 'Dana Whitlock')).toBe(3)
  })

  it('does not find a name inside a longer one', () => {
    expect(mentionIndex('ask @Chris Bellamy', 'Chris Bell')).toBe(-1)
    expect(mentionIndex('ask @Chris Bellamy and @Chris Bell', 'Chris Bell')).toBe(23)
  })

  it('does not find a name glued to the word before it', () => {
    expect(mentionIndex('mail joe@Dana Whitlock', 'Dana Whitlock')).toBe(-1)
  })

  it('keeps only the picks still in the words', () => {
    const picked = [
      { userId: 'u-dana', name: 'Dana Whitlock' },
      { userId: 'u-luis', name: 'Luis Ortega' },
    ]
    expect(liveTags('@Dana Whitlock did the check come?', picked)).toEqual([picked[0]])
    expect(liveTags('did the check come?', picked)).toEqual([])
  })

  it('drops a pick the writer cut short', () => {
    expect(liveTags('@Dana Whit did it come?', [{ name: 'Dana Whitlock' }])).toEqual([])
  })
})

describe('removePick', () => {
  it('takes the name and one space off', () => {
    expect(removePick('@Dana Whitlock did it come?', 'Dana Whitlock')).toBe('did it come?')
    expect(removePick('did it come? @Dana Whitlock', 'Dana Whitlock')).toBe('did it come?')
    expect(removePick('ask @Dana Whitlock today', 'Dana Whitlock')).toBe('ask today')
  })

  it('takes every copy of that name and leaves another person alone', () => {
    expect(removePick('@Chris Bell and @Chris Bellamy and @Chris Bell', 'Chris Bell')).toBe('and @Chris Bellamy and')
  })

  it('leaves the words alone when the name is not in them', () => {
    expect(removePick('arrive @ 8:45', 'Dana Whitlock')).toBe('arrive @ 8:45')
  })
})

describe('noteBodyParts', () => {
  it('cuts a note into words and chips', () => {
    expect(noteBodyParts('we got it yet? @Dana Whitlock', ['Dana Whitlock'])).toEqual([
      { kind: 'text', text: 'we got it yet? ' },
      { kind: 'tag', name: 'Dana Whitlock' },
    ])
  })

  it('handles a chip at the start and two people', () => {
    expect(noteBodyParts('@Dana Whitlock and @Luis Ortega can we?', ['Luis Ortega', 'Dana Whitlock'])).toEqual([
      { kind: 'tag', name: 'Dana Whitlock' },
      { kind: 'text', text: ' and ' },
      { kind: 'tag', name: 'Luis Ortega' },
      { kind: 'text', text: ' can we?' },
    ])
  })

  it('picks the longer of two names that start alike', () => {
    expect(noteBodyParts('@Chris Bellamy first', ['Chris Bell', 'Chris Bellamy'])).toEqual([
      { kind: 'tag', name: 'Chris Bellamy' },
      { kind: 'text', text: ' first' },
    ])
  })

  it('leaves a typed @ that is no tag as plain words', () => {
    expect(noteBodyParts('arrive @ 8:45 @dana', ['Dana Whitlock'])).toEqual([{ kind: 'text', text: 'arrive @ 8:45 @dana' }])
  })

  it('reads whole with no names, and empty for an empty note', () => {
    expect(noteBodyParts('on going', [])).toEqual([{ kind: 'text', text: 'on going' }])
    expect(noteBodyParts('', ['Dana Whitlock'])).toEqual([])
  })
})

describe('waitingOnWords', () => {
  const everyone = PEOPLE.map((p) => p.name)

  it('uses the first name alone', () => {
    expect(waitingOnWords(['Dana Whitlock'], everyone)).toBe('waiting on Dana')
  })

  it('writes the name whole when two people share a first name', () => {
    expect(waitingOnWords(['Chris Bell'], everyone)).toBe('waiting on Chris Bell')
    expect(waitingOnWords(['Chris Bell', 'Luis Ortega'], everyone)).toBe('waiting on Chris Bell and Luis')
  })

  it('joins three with a comma and an and', () => {
    expect(waitingOnWords(['Dana Whitlock', 'Luis Ortega', 'Marcus Hale'], everyone)).toBe(
      'waiting on Dana, Luis and Marcus',
    )
  })

  it('says a person once and nothing for nobody', () => {
    expect(waitingOnWords(['Dana Whitlock', 'Dana Whitlock'], [])).toBe('waiting on Dana')
    expect(waitingOnWords([], everyone)).toBe('')
  })
})

describe('the age rule', () => {
  // 2026-11-15 is a Sunday.
  const today = '2026-11-15'

  it('counts calendar days and never goes below zero', () => {
    expect(tagAgeDays('2026-11-11', today)).toBe(4)
    expect(tagAgeDays(today, today)).toBe(0)
    expect(tagAgeDays('2026-11-16', today)).toBe(0)
    expect(tagAgeDays('not a day', today)).toBe(0)
  })

  it('counts Monday to Friday after the day posted', () => {
    expect(workingDaysWaited('2026-11-13', today)).toBe(0) // Friday to Sunday
    expect(workingDaysWaited('2026-11-12', today)).toBe(1) // Thursday: Friday counts
    expect(workingDaysWaited('2026-11-11', today)).toBe(2) // Wednesday: Thursday and Friday
    expect(workingDaysWaited('2026-11-13', '2026-11-17')).toBe(2) // Friday to Tuesday
  })

  it('turns amber at two working days', () => {
    expect(tagIsLate('2026-11-13', today)).toBe(false)
    expect(tagIsLate('2026-11-12', today)).toBe(false)
    expect(tagIsLate('2026-11-11', today)).toBe(true)
    expect(tagIsLate('2026-11-10', today)).toBe(true)
    expect(tagIsLate('2026-06-01', today)).toBe(true)
  })

  it('says nothing on the day and the days after it', () => {
    expect(tagAgeWords(today, today)).toBe('')
    expect(tagAgeWords('2026-11-14', today)).toBe('1d')
    expect(tagAgeWords('2026-11-11', today)).toBe('4d')
  })
})

describe('the mark on a note', () => {
  const tag = (name: string, userId: string, how: NoteTagRow['clearedHow'] = null): NoteTagRow => ({
    noteId: 'n1',
    taggedUserId: userId,
    taggedName: name,
    taggerUserId: 'u-marcus',
    createdAt: '2026-11-11T21:40:00Z',
    clearedAt: how ? '2026-11-12T15:00:00Z' : null,
    clearedHow: how,
  })
  const at = { viewerId: 'u-marcus', postedYmd: '2026-11-11', todayYmd: '2026-11-15' }

  it('is null for a note with no tag', () => {
    expect(noteTagMark([], at)).toBeNull()
  })

  it('says who it waits on, how long, and that it is late', () => {
    expect(noteTagMark([tag('Dana Whitlock', 'u-dana')], at)).toEqual({
      names: ['Dana Whitlock'],
      mine: [],
      words: 'waiting on Dana · 4d',
      waiting: true,
      late: true,
    })
  })

  it('says you to the tagged reader, first, and marks their chip', () => {
    const mark = noteTagMark([tag('Luis Ortega', 'u-luis'), tag('Dana Whitlock', 'u-dana')], { ...at, viewerId: 'u-dana', todayYmd: '2026-11-11' })
    expect(mark?.words).toBe('waiting on you and Luis')
    expect(mark?.mine).toEqual(['Dana Whitlock'])
    expect(mark?.late).toBe(false)
  })

  it('names only the people still owed while one has answered', () => {
    expect(noteTagMark([tag('Dana Whitlock', 'u-dana', 'answered'), tag('Luis Ortega', 'u-luis')], at)?.words).toBe('waiting on Luis · 4d')
  })

  it('says how it ended once all have cleared', () => {
    expect(noteTagMark([tag('Dana Whitlock', 'u-dana', 'answered')], at)).toMatchObject({ words: 'answered by Dana', waiting: false, late: false })
    expect(noteTagMark([tag('Dana Whitlock', 'u-dana', 'done')], at)?.words).toBe('Dana: no reply needed')
    expect(noteTagMark([tag('Dana Whitlock', 'u-dana', 'answered'), tag('Luis Ortega', 'u-luis', 'done')], at)?.words).toBe(
      'answered by Dana · Luis: no reply needed',
    )
  })

  it('writes a shared first name whole', () => {
    expect(noteTagMark([tag('Chris Bell', 'u-bell')], { ...at, everyone: ['Chris Alvarez'] })?.words).toBe('waiting on Chris Bell · 4d')
  })

  it('groups the rows of a job by note', () => {
    const rows = [tag('Dana Whitlock', 'u-dana'), { ...tag('Luis Ortega', 'u-luis'), noteId: 'n2' }, tag('Chris Bell', 'u-bell')]
    const by = tagsByNote(rows)
    expect(by.get('n1')?.map((r) => r.taggedName)).toEqual(['Dana Whitlock', 'Chris Bell'])
    expect(by.get('n2')).toHaveLength(1)
  })

  it('offers the @ to a dev alone until the section lands', () => {
    expect(canTagInJobNotes('dev')).toBe(true)
    expect(canTagInJobNotes('assistant')).toBe(false)
    expect(canTagInJobNotes(null)).toBe(false)
  })
})

describe('the section', () => {
  const tags = [
    { id: 'c', createdAt: '2026-11-15T16:04:00Z' },
    { id: 'a', createdAt: '2026-11-11T21:40:00Z' },
    { id: 'b', createdAt: '2026-11-13T15:00:00Z' },
    { id: 'd', createdAt: '2026-11-15T17:00:00Z' },
  ]

  it('puts the oldest tag on top and leaves the list it was given alone', () => {
    expect(oldestFirst(tags).map((t) => t.id)).toEqual(['a', 'b', 'c', 'd'])
    expect(tags[0]!.id).toBe('c')
  })

  it('shows three and counts the rest', () => {
    const split = sectionSplit(oldestFirst(tags), false)
    expect(split.shown.map((t) => t.id)).toEqual(['a', 'b', 'c'])
    expect(split.rest).toBe(1)
    expect(TAG_SECTION_SHOWN).toBe(3)
  })

  it('shows all of them after Show the rest, and when there are three or fewer', () => {
    expect(sectionSplit(tags, true)).toEqual({ shown: tags, rest: 0 })
    expect(sectionSplit(tags.slice(0, 3), false).rest).toBe(0)
  })
})
