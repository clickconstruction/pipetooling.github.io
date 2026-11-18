import { describe, expect, it } from 'vitest'
import { TASK_PUSH_URL, clip, donePush, firstName, notePushes, pushUrlFor, taskDonePush, taskNotePushes, taskTitleWords } from '../../../supabase/functions/notify-note-tag/words'
import { taskTitlePlain } from '../tasks/taskPlace'

/**
 * The words and the door of the notify-note-tag pushes (punch list #363, PR 5). The function reads the rows and
 * hands the facts to these; nothing a caller sends becomes a word.
 */
describe('notify-note-tag words', () => {
  const base = { noteId: 'n1', noteBody: 'Did the check for the change order come in yet? @Dana Whitlock', jobName: 'Cedar Bluff Lofts', authorName: 'Marcus Hale' }

  it('lands the office on the Pipeline and everyone else on the Dashboard', () => {
    for (const role of ['dev', 'master_technician', 'assistant', 'controller']) expect(pushUrlFor(role), role).toBe('/jobs?tab=stages')
    for (const role of ['superintendent', 'helpers', 'primary', null]) expect(pushUrlFor(role), String(role)).toBe('/dashboard')
  })

  it('tells the tagged person who tagged them, on which job, with the note', () => {
    expect(notePushes({ ...base, tagged: [{ userId: 'u-dana', role: 'assistant' }], askers: [] })).toEqual([
      {
        userIds: ['u-dana'],
        title: 'Marcus tagged you on Cedar Bluff Lofts',
        body: 'Did the check for the change order come in yet? @Dana Whitlock',
        url: '/jobs?tab=stages',
        tag: 'note-tag-n1',
        templateType: 'note_tag',
      },
    ])
  })

  it('sends one push per door when the tagged people land in different places', () => {
    const pushes = notePushes({
      ...base,
      tagged: [
        { userId: 'u-dana', role: 'assistant' },
        { userId: 'u-luis', role: 'superintendent' },
        { userId: 'u-bell', role: 'controller' },
        { userId: 'u-dana', role: 'assistant' },
      ],
      askers: [],
    })
    expect(pushes.map((p) => [p.url, p.userIds])).toEqual([
      ['/jobs?tab=stages', ['u-dana', 'u-bell']],
      ['/dashboard', ['u-luis']],
    ])
  })

  it('tells the asker that the answer landed', () => {
    const [push] = notePushes({ ...base, noteBody: 'Yes, it came Friday.', authorName: 'Dana Whitlock', tagged: [], askers: [{ userId: 'u-marcus', role: 'master_technician' }] })
    expect(push).toMatchObject({ userIds: ['u-marcus'], title: 'Dana answered on Cedar Bluff Lofts', body: 'Yes, it came Friday.', templateType: 'note_tag_answer', tag: 'note-tag-answer-n1' })
  })

  it('sends the tag alone to an asker the answer tags back', () => {
    const pushes = notePushes({ ...base, authorName: 'Dana Whitlock', tagged: [{ userId: 'u-marcus', role: 'master_technician' }], askers: [{ userId: 'u-marcus', role: 'master_technician' }] })
    expect(pushes).toHaveLength(1)
    expect(pushes[0]!.templateType).toBe('note_tag')
  })

  it('sends nothing for a note that tags nobody and answers nothing', () => {
    expect(notePushes({ ...base, tagged: [], askers: [] })).toEqual([])
  })

  it('names a job with no name and a writer with none', () => {
    const [push] = notePushes({ ...base, jobName: '  ', authorName: null, tagged: [{ userId: 'u-dana', role: 'helpers' }], askers: [] })
    expect(push!.title).toBe('A teammate tagged you on a job')
    expect(firstName('  Luis  Ortega ')).toBe('Luis')
  })

  it('tells the asker who pressed No reply needed, and on which note', () => {
    expect(donePush({ tagId: 't1', noteBody: 'Permit is on the door.', jobName: 'Oak Hollow Clinic', taggedName: 'Chris Bell', asker: { userId: 'u-dana', role: 'assistant' } })).toEqual({
      userIds: ['u-dana'],
      title: 'Chris: no reply needed',
      body: 'Oak Hollow Clinic: Permit is on the door.',
      url: '/jobs?tab=stages',
      tag: 'note-tag-done-t1',
      templateType: 'note_tag_answer',
    })
  })

  it('cuts a long note on a word and keeps a short one whole', () => {
    expect(clip('short  note\nhere')).toBe('short note here')
    const long = 'word '.repeat(60).trim()
    const cut = clip(long)
    expect(cut.length).toBeLessThanOrEqual(140)
    expect(cut.endsWith('word…')).toBe(true)
  })

  describe('task notes (punch list #375)', () => {
    const task = { eventId: 'e1', noteBody: 'Which bay first? @Dana Whitlock', taskTitle: '{{1:1466 · Cedar Bluff Lofts}} — Sweep the shop bays', authorName: 'Luis Ortega' }

    it('reads a task title as plain words, the job token and all, as the app does', () => {
      expect(taskTitleWords(task.taskTitle)).toBe('1466 · Cedar Bluff Lofts — Sweep the shop bays')
      expect(taskTitleWords('Lock the yard gate')).toBe('Lock the yard gate')
      expect(taskTitleWords('  ')).toBe('a task')
      expect(taskTitleWords(null)).toBe('a task')
      // The function cannot import src/lib, so its reader is its own. The two must agree on any title that has words.
      for (const title of [task.taskTitle, 'Lock the yard gate', '{{1:J12 · Tanner}} and {{2:J13 · Oak}} —  both', 'a {{x}} b']) expect(taskTitleWords(title), title).toBe(taskTitlePlain(title))
    })

    it('tells the tagged person who tagged them, on which task, and lands every role on the Checklist', () => {
      expect(taskNotePushes({ ...task, tagged: [{ userId: 'u-dana', role: 'assistant' }, { userId: 'u-hector', role: 'helpers' }], askers: [] })).toEqual([
        {
          userIds: ['u-dana', 'u-hector'],
          title: 'Luis tagged you on 1466 · Cedar Bluff Lofts — Sweep the shop bays',
          body: 'Which bay first? @Dana Whitlock',
          url: '/checklist?tab=today',
          tag: 'task-note-tag-e1',
          templateType: 'task_note_tag',
        },
      ])
      expect(TASK_PUSH_URL).toBe('/checklist?tab=today')
    })

    it('tells the asker the answer landed, and gives a person tagged back the tag alone', () => {
      const pushes = taskNotePushes({ ...task, noteBody: 'Bay 2. @Marcus Hale which hose?', tagged: [{ userId: 'u-marcus', role: 'master_technician' }], askers: [{ userId: 'u-marcus', role: 'master_technician' }, { userId: 'u-dana', role: 'assistant' }] })
      expect(pushes.map((p) => [p.templateType, p.userIds, p.title])).toEqual([
        ['task_note_tag', ['u-marcus'], 'Luis tagged you on 1466 · Cedar Bluff Lofts — Sweep the shop bays'],
        ['note_tag_answer', ['u-dana'], 'Luis answered on 1466 · Cedar Bluff Lofts — Sweep the shop bays'],
      ])
    })

    it('sends nothing for a task note that tags nobody and answers nothing', () => {
      expect(taskNotePushes({ ...task, tagged: [], askers: [] })).toEqual([])
    })

    it('cuts a long title so the notice still says who and what', () => {
      const long = taskNotePushes({ ...task, taskTitle: 'Walk every unit on the third floor and write down each fixture that still needs its trim set before Friday', tagged: [{ userId: 'u-dana', role: 'assistant' }], askers: [] })[0]!
      expect(long.title.startsWith('Luis tagged you on Walk every unit')).toBe(true)
      expect(long.title.endsWith('…')).toBe(true)
      expect(long.title.length).toBeLessThanOrEqual('Luis tagged you on '.length + 60)
    })

    it('tells the asker when a task tag was cleared with no note', () => {
      expect(taskDonePush({ tagId: 't1', noteBody: task.noteBody, taskTitle: 'Lock the yard gate', taggedName: 'Dana Whitlock', asker: { userId: 'u-luis', role: 'superintendent' } })).toEqual({
        userIds: ['u-luis'],
        title: 'Dana: no reply needed',
        body: 'Lock the yard gate: Which bay first? @Dana Whitlock',
        url: '/checklist?tab=today',
        tag: 'task-note-tag-done-t1',
        templateType: 'note_tag_answer',
      })
    })
  })
})
