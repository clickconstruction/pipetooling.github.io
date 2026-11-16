import { describe, expect, it } from 'vitest'
import { clip, donePush, firstName, notePushes, pushUrlFor } from '../../../supabase/functions/notify-note-tag/words'

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
})
