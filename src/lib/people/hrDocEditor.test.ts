import { describe, expect, it } from 'vitest'
import { hrDocDraftWords, hrDocSaveFailureWords, hrDocSavePayload, hrDocSaveWasStale } from './hrDocEditor'

describe('hrDocEditor (People → HR edits the summary and the narrative, v2.6609)', () => {
  it('the save payload carries the whole text and the loaded updated_at, and no expectation for a document that does not exist yet', () => {
    expect(hrDocSavePayload({ personId: 'p1', kind: 'narrative', markdown: '## 2026\n\nStarted.', loadedUpdatedAt: '2026-11-06T22:00:00+00:00' })).toEqual({
      person_id: 'p1', kind: 'narrative', markdown: '## 2026\n\nStarted.', expect_updated_at: '2026-11-06T22:00:00+00:00',
    })
    expect(hrDocSavePayload({ personId: 'p1', kind: 'summary', markdown: 'Steady.', loadedUpdatedAt: null })).toEqual({ person_id: 'p1', kind: 'summary', markdown: 'Steady.' })
  })

  it('the draft words: nothing yet, an emptied document, or the size and how it moved', () => {
    expect(hrDocDraftWords('summary', 'same', 'same')).toEqual({ changed: false, words: 'Nothing changed yet.' })
    expect(hrDocDraftWords('summary', '  \n', 'was here')).toEqual({ changed: true, words: 'Save empties the summary. The prior version stays in its history.' })
    expect(hrDocDraftWords('narrative', 'a'.repeat(1200), 'a'.repeat(1000)).words).toBe('Save keeps 1,200 characters, 200 more than before. The prior version stays in its history.')
    expect(hrDocDraftWords('narrative', 'ab', 'abcd').words).toBe('Save keeps 2 characters, 2 fewer than before. The prior version stays in its history.')
    expect(hrDocDraftWords('narrative', 'ab', 'cd').words).toBe('Save keeps 2 characters, the same count as before. The prior version stays in its history.')
  })

  it('reads the stale refusal and adds the way out to it, and passes any other reason through', () => {
    const stale = 'dev_person_doc_write: the narrative was saved at 2026-11-06 22:10:00Z by Robert, after the version you loaded (2026-11-06 22:00:00Z). Read it again and edit from that.'
    expect(hrDocSaveWasStale(stale)).toBe(true)
    expect(hrDocSaveWasStale('dev_person_doc_write: devs only')).toBe(false)
    expect(hrDocSaveFailureWords('narrative', stale)).toBe(`Could not save the narrative: ${stale} Copy your words, press Cancel, open it again and bring them over.`)
    expect(hrDocSaveFailureWords('summary', 'devs only')).toBe('Could not save the summary: devs only')
  })
})
