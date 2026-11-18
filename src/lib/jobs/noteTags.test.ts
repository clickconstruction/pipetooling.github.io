import { describe, expect, it } from 'vitest'
import {
  TAG_SECTION_SHOWN,
  askedLineWords,
  backspaceTag,
  backspacedTag,
  canTagInJobNotes,
  canTagInTaskNotes,
  draftMarkParts,
  insertPick,
  liveTags,
  mentionIndex,
  myTagsView,
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
  tagIsTask,
  tagPersonSays,
  tagNameQueryAtCaret,
  tagQueryAtCaret,
  tagTypingAtCaret,
  tagWhere,
  taskOffer,
  tagsByNote,
  tagsNeed,
  tagsOfKind,
  waitingOnWords,
  workingDaysWaited,
  type MyTag,
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

describe('the @ being typed, through a space (punch list #375)', () => {
  const NAMES = ['Dana Whitlock', 'Chris Bell', 'Chris Bellamy', 'Will Hart', 'José Peña']

  it('reads one word as it always did', () => {
    expect(tagNameQueryAtCaret('ask @ch', 7, NAMES)).toEqual({ query: 'ch', start: 4 })
    expect(tagNameQueryAtCaret('@', 1, NAMES)).toEqual({ query: '', start: 0 })
    // One word is a query whether or not anyone fits: the row decides what to show.
    expect(tagNameQueryAtCaret('@home', 5, NAMES)).toEqual({ query: 'home', start: 0 })
  })

  it('stays open through a space while the words still start a name', () => {
    expect(tagNameQueryAtCaret('ask @chris b', 12, NAMES)).toEqual({ query: 'chris b', start: 4 })
    expect(tagNameQueryAtCaret('@chris ', 7, NAMES)).toEqual({ query: 'chris ', start: 0 })
    expect(tagNameQueryAtCaret('@jose p', 7, NAMES)).toEqual({ query: 'jose p', start: 0 })
  })

  it('shuts once the words are nobody', () => {
    expect(tagNameQueryAtCaret('@will call', 10, NAMES)).toBeNull()
    expect(tagNameQueryAtCaret('@home tomorrow', 14, NAMES)).toBeNull()
    // A last name alone does not run through a space: only the start of the whole name does.
    expect(tagNameQueryAtCaret('@bell ', 6, NAMES)).toBeNull()
    // With no names read yet, a space shuts it.
    expect(tagNameQueryAtCaret('@chris b', 8, [])).toBeNull()
  })

  it('opens nothing for an at sign that means at', () => {
    expect(tagNameQueryAtCaret('arrive @ 8:45', 13, NAMES)).toBeNull()
    expect(tagNameQueryAtCaret('arrive @ noon', 13, NAMES)).toBeNull()
    expect(tagNameQueryAtCaret('materials @$300', 15, NAMES)).toBeNull()
    expect(tagNameQueryAtCaret('mail dana@example.com', 21, NAMES)).toBeNull()
    expect(tagNameQueryAtCaret('no at here', 10, NAMES)).toBeNull()
  })

  it('leaves a made tag alone', () => {
    const text = 'ask @Chris Bell about it'
    // Right after the name, in the middle of it, and in the words that follow it.
    expect(tagNameQueryAtCaret(text, 15, NAMES, ['Chris Bell'])).toBeNull()
    expect(tagNameQueryAtCaret(text, 12, NAMES, ['Chris Bell'])).toBeNull()
    expect(tagNameQueryAtCaret(text, 24, NAMES, ['Chris Bell'])).toBeNull()
    // The same letters with no tag made are still a query.
    expect(tagNameQueryAtCaret('ask @Chris Bell', 15, NAMES)).toEqual({ query: 'Chris Bell', start: 4 })
    // A second @ after a made tag is its own query.
    expect(tagNameQueryAtCaret('@Chris Bell and @da', 19, NAMES, ['Chris Bell'])).toEqual({ query: 'da', start: 16 })
  })

  it('reads the shape alone when it is handed no names', () => {
    expect(tagTypingAtCaret('@chris b', 8)).toEqual({ query: 'chris b', start: 0 })
    expect(tagTypingAtCaret('@ noon', 6)).toBeNull()
    expect(tagTypingAtCaret('x@y', 3)).toBeNull()
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

describe('nameMatchesQuery past a space (punch list #375)', () => {
  it('fits only the start of the whole name', () => {
    expect(nameMatchesQuery('Chris Bell', 'chris b')).toBe(true)
    expect(nameMatchesQuery('Chris Bellamy', 'chris b')).toBe(true)
    expect(nameMatchesQuery('Chris Bell', 'chris ')).toBe(true)
    expect(nameMatchesQuery('Christine Poe', 'chris ')).toBe(false)
    expect(nameMatchesQuery('Chris Bell', 'bell c')).toBe(false)
    expect(nameMatchesQuery('José  Peña', 'jose p')).toBe(true)
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

describe('a task\'s own people (punch list #375)', () => {
  const TASK: TaggablePerson[] = [
    { userId: 'u-marcus', name: 'Marcus Hale', role: 'master_technician', onJob: false },
    { userId: 'u-luis', name: 'Luis Ortega', role: 'superintendent', onJob: false, onTask: true },
    { userId: 'u-dana', name: 'Dana Whitlock', role: 'assistant', onJob: false, onTask: true, gave: true },
    { userId: 'u-ana', name: 'Ana Ruiz', role: 'helpers', onJob: false, onTask: true },
    { userId: 'u-bo', name: 'Bo Tran', role: 'helpers', onJob: false, onTask: true },
  ]

  it('lists the task\'s people before the office', () => {
    expect(names(rankTaggable(TASK, ''))).toEqual(['task:Ana Ruiz', 'task:Bo Tran', 'task:Dana Whitlock', 'task:Luis Ortega', 'office:Marcus Hale'])
  })

  it('says what each person is to the task', () => {
    const says = Object.fromEntries(rankTaggable(TASK, '').map((r) => [r.person.name, tagPersonSays(r)]))
    expect(says).toEqual({ 'Ana Ruiz': 'has this task', 'Bo Tran': 'has this task', 'Dana Whitlock': 'gave this task', 'Luis Ortega': 'has this task', 'Marcus Hale': 'office' })
    // A job's rows read as they did.
    expect(rankTaggable(PEOPLE, 'luis').map(tagPersonSays)).toEqual(['superintendent · on this job'])
    expect(tagPersonSays({ person: PEOPLE[0]!, group: 'asked' })).toBe('asked you')
  })

  it('offers three of the task\'s own people before a letter is typed, whoever gave it first', () => {
    expect(taskOffer(TASK).map((r) => r.person.name)).toEqual(['Dana Whitlock', 'Ana Ruiz', 'Bo Tran'])
    // Someone already tagged is not offered again, and the office never is.
    expect(taskOffer(TASK, ['u-dana', 'u-ana']).map((r) => r.person.name)).toEqual(['Bo Tran', 'Luis Ortega'])
    expect(taskOffer(PEOPLE)).toEqual([])
  })

  it('opens the @ in a task\'s note box to the roles a job\'s is open to', () => {
    for (const role of ['dev', 'master_technician', 'assistant', 'controller', 'superintendent', 'helpers', 'primary']) expect(canTagInTaskNotes(role)).toBe(true)
    expect(canTagInTaskNotes('subcontractor')).toBe(false)
    expect(canTagInTaskNotes('estimator')).toBe(false)
    expect(canTagInTaskNotes(null)).toBe(false)
  })
})

describe('insertPick with the row\'s own @ (punch list #375)', () => {
  it('replaces a query that ran through a space', () => {
    expect(insertPick('ask @chris b', 12, 'Chris Bell', 4)).toEqual({ text: 'ask @Chris Bell ', caret: 16 })
  })

  it('puts a name pressed cold at the caret, whatever was typed before it', () => {
    expect(insertPick('see @will call', 14, 'Dana Whitlock', null)).toEqual({ text: 'see @will call @Dana Whitlock ', caret: 30 })
    expect(insertPick('', 0, 'Dana Whitlock', null)).toEqual({ text: '@Dana Whitlock ', caret: 15 })
  })
})

describe('one Backspace takes a tag off (punch list #375)', () => {
  const LIVE = ['Dana Whitlock', 'Chris Bell']

  it('takes the whole name, with the space a pick left', () => {
    expect(backspaceTag('ask @Dana Whitlock ', 19, LIVE)).toEqual({ text: 'ask ', caret: 4 })
    expect(backspaceTag('ask @Dana Whitlock', 18, LIVE)).toEqual({ text: 'ask ', caret: 4 })
    expect(backspaceTag('ask @Dana Whitlock about it', 19, LIVE)).toEqual({ text: 'ask about it', caret: 4 })
  })

  it('is an ordinary Backspace anywhere else', () => {
    expect(backspaceTag('ask @Dana Whitlock now', 22, LIVE)).toBeNull()
    expect(backspaceTag('ask @Dana Whit', 14, LIVE)).toBeNull()
    // A name that was only typed is plain words.
    expect(backspaceTag('ask @Luis Ortega ', 17, LIVE)).toBeNull()
    // Chris Bell is not the start of Chris Bellamy.
    expect(backspaceTag('@Chris Bellamy', 11, LIVE)).toBeNull()
    expect(backspaceTag('', 0, LIVE)).toBeNull()
  })

  it('reads the same from a change the keyboard did not name', () => {
    expect(backspacedTag('ask @Dana Whitlock ', 'ask @Dana Whitlock', 18, LIVE)).toEqual({ text: 'ask ', caret: 4 })
    expect(backspacedTag('ask @Dana Whitlock', 'ask @Dana Whitloc', 17, LIVE)).toEqual({ text: 'ask ', caret: 4 })
    // A letter typed, a letter taken elsewhere, and two letters gone are not it.
    expect(backspacedTag('ask @Dana Whitlock ', 'ask @Dana Whitlock x', 20, LIVE)).toBeNull()
    expect(backspacedTag('ask @Dana Whitlock ', 'as @Dana Whitlock ', 2, LIVE)).toBeNull()
    expect(backspacedTag('ask @Dana Whitlock ', 'ask @Dana Whitloc', 17, LIVE)).toBeNull()
  })
})

describe('the mark in the words (punch list #375)', () => {
  it('cuts the words into runs that join back whole', () => {
    const text = 'ask @Dana Whitlock and @ch'
    const parts = draftMarkParts(text, ['Dana Whitlock'], { start: 23, end: 26 })
    expect(parts).toEqual([
      { text: 'ask ', mark: null },
      { text: '@Dana Whitlock', mark: 'tag' },
      { text: ' and ', mark: null },
      { text: '@ch', mark: 'typing' },
    ])
    expect(parts.map((p) => p.text).join('')).toBe(text)
  })

  it('marks every place a tagged name is written, and no name only typed', () => {
    expect(draftMarkParts('@Chris Bell or @Chris Bellamy, @Chris Bell', ['Chris Bell'])).toEqual([
      { text: '@Chris Bell', mark: 'tag' },
      { text: ' or @Chris Bellamy, ', mark: null },
      { text: '@Chris Bell', mark: 'tag' },
    ])
    expect(draftMarkParts('plain words', [])).toEqual([{ text: 'plain words', mark: null }])
    expect(draftMarkParts('', ['Dana Whitlock'])).toEqual([])
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

  it('offers the @ to the office and the crew roles, and not to a sub or an estimator', () => {
    for (const role of ['dev', 'master_technician', 'assistant', 'controller', 'superintendent', 'helpers', 'primary']) expect(canTagInJobNotes(role), role).toBe(true)
    for (const role of ['subcontractor', 'estimator', null, undefined]) expect(canTagInJobNotes(role), String(role)).toBe(false)
  })
})

describe('the reader\'s own tags', () => {
  const mine = (over: Partial<MyTag>): MyTag => ({
    tagId: 't',
    kind: 'waiting',
    noteId: 'n',
    jobId: 'j',
    jobName: 'Cedar Bluff Lofts',
    jobNumber: 'J1482',
    jobKind: null,
    customerName: 'Ridgeway Builders',
    noteBody: 'Did the check come? @Dana Whitlock',
    noteCreatedAt: '2026-11-11T21:40:00Z',
    taggerUserId: 'u-marcus',
    taggerName: 'Marcus Hale',
    taggedUserId: 'u-dana',
    taggedName: 'Dana Whitlock',
    createdAt: '2026-11-11T21:40:00Z',
    clearedAt: null,
    clearedHow: null,
    answerBody: null,
    askerSeenAt: null,
    ...over,
  })
  const tags = [
    mine({ tagId: 'w2', createdAt: '2026-11-15T16:04:00Z' }),
    mine({ tagId: 'w1', createdAt: '2026-11-11T21:40:00Z', jobName: 'Tanner residence' }),
    mine({ tagId: 'a-seen', kind: 'asked', clearedAt: '2026-11-13T15:00:00Z', clearedHow: 'answered', answerBody: 'Yes.', askerSeenAt: '2026-11-13T16:00:00Z' }),
    mine({ tagId: 'a-open', kind: 'asked' }),
    mine({ tagId: 'a-new', kind: 'asked', clearedAt: '2026-11-15T15:00:00Z', clearedHow: 'answered', answerBody: 'Permit is posted.' }),
  ]

  it('puts the oldest waiting tag on top and an unseen answer first under You asked', () => {
    const view = myTagsView(tags)
    expect(view.waiting.map((t) => t.tagId)).toEqual(['w1', 'w2'])
    expect(view.asked.map((t) => t.tagId)).toEqual(['a-new', 'a-open', 'a-seen'])
    expect(view.unseen).toBe(1)
    expect(view.count).toBe(3)
  })

  it('counts nothing for tags the reader asked that still wait or were seen', () => {
    expect(myTagsView(tags.filter((t) => t.tagId === 'a-open' || t.tagId === 'a-seen')).count).toBe(0)
  })

  it('says how a tag the reader asked stands', () => {
    expect(askedLineWords(tags[3]!, '2026-11-15', '2026-11-11')).toEqual({ words: 'no answer yet · 4d', tone: 'late' })
    expect(askedLineWords(tags[3]!, '2026-11-11', '2026-11-11')).toEqual({ words: 'no answer yet', tone: 'waiting' })
    expect(askedLineWords(tags[4]!, '2026-11-15', '2026-11-11')).toEqual({ words: 'answered: Permit is posted.', tone: 'cleared' })
    expect(askedLineWords(mine({ kind: 'asked', clearedAt: 'x', clearedHow: 'done' }), '2026-11-15', '2026-11-11').words).toBe('no reply needed')
  })

  it('words the Needs you line, and has none when nothing waits', () => {
    expect(tagsNeed(myTagsView(tags))).toEqual({ count: 3, title: '2 job notes tagged you · 1 answer to a note you tagged', detail: 'Tanner residence · Cedar Bluff Lofts' })
    expect(tagsNeed(myTagsView([tags[0]!]))?.title).toBe('1 job note tagged you')
    expect(tagsNeed(myTagsView([tags[3]!]))).toBeNull()
  })

  describe('job tags and task tags side by side (punch list #375)', () => {
    const jobTag = mine({ tagId: 'j1', jobName: 'Cedar Bluff Lofts', createdAt: '2026-11-15T16:04:00Z' })
    const taskTag = mine({ tagId: 't1', source: 'task', jobId: '', jobName: '', instanceId: 'inst-1', itemId: 'item-1', taskTitle: '{{1:1466 · Cedar Bluff Lofts}} — Sweep the shop bays', taskDate: '2026-11-17', createdAt: '2026-11-14T10:00:00Z' })
    const askedTask = mine({ tagId: 't2', kind: 'asked', source: 'task', jobId: '', jobName: '', taskTitle: 'Lock the yard gate', clearedAt: '2026-11-16T10:00:00Z', clearedHow: 'answered' })

    it('tells the kinds apart and keeps each list to its own', () => {
      expect(tagIsTask(jobTag)).toBe(false)
      expect(tagIsTask(taskTag)).toBe(true)
      expect(tagsOfKind([jobTag, taskTag], 'job').map((t) => t.tagId)).toEqual(['j1'])
      expect(tagsOfKind([jobTag, taskTag], 'task').map((t) => t.tagId)).toEqual(['t1'])
      expect(tagsOfKind([jobTag, taskTag], 'both').map((t) => t.tagId)).toEqual(['j1', 't1'])
      // Each count is its own kind's: the number above Jobs never holds a task tag.
      expect(myTagsView(tagsOfKind([jobTag, taskTag, askedTask], 'job')).count).toBe(1)
      expect(myTagsView(tagsOfKind([jobTag, taskTag, askedTask], 'task')).count).toBe(2)
    })

    it('names a task by its title as plain words, the job token and all', () => {
      expect(tagWhere(taskTag)).toBe('1466 · Cedar Bluff Lofts — Sweep the shop bays')
      expect(tagWhere(jobTag)).toBe('Cedar Bluff Lofts')
      expect(tagWhere(mine({ jobName: '  ' }))).toBe('A job')
      expect(tagWhere(mine({ source: 'task', taskTitle: null }))).toBe('Task')
    })

    it('lists both in one window, the oldest first', () => {
      expect(myTagsView([jobTag, taskTag]).waiting.map((t) => t.tagId)).toEqual(['t1', 'j1'])
    })

    it('writes one Needs you line for both kinds', () => {
      expect(tagsNeed(myTagsView([jobTag, taskTag, askedTask]))).toEqual({
        count: 3,
        title: '1 job note tagged you · 1 task note tagged you · 1 answer to a note you tagged',
        detail: '1466 · Cedar Bluff Lofts — Sweep the shop bays · Cedar Bluff Lofts',
      })
      expect(tagsNeed(myTagsView([taskTag, { ...taskTag, tagId: 't3' }]))?.title).toBe('2 task notes tagged you')
    })

    it('says has left for an open tag on someone archived, in place of an age', () => {
      const open = mine({ kind: 'asked', taggedLeft: true })
      expect(askedLineWords(open, '2026-11-17', '2026-11-10')).toEqual({ words: 'has left', tone: 'late' })
      // A tag that cleared before the person left still says how.
      expect(askedLineWords({ ...open, clearedAt: '2026-11-11T10:00:00Z', clearedHow: 'done' }, '2026-11-17', '2026-11-10').words).toBe('no reply needed')
    })
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
