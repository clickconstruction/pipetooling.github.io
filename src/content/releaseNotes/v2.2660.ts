import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2660',
  date: '2026-09-02',
  title: 'Email wording polish: GC statements, test sends, dead wood',
  kind: 'feature',
  highlights: [
    'Scheduled GC statements join the editable-wording family — subject and intro paragraph, including the company name that used to be frozen in code.',
    'Every customer and digest template card now has a Test button that emails the wording to your chosen test target.',
    'Housekeeping: the "Login As" template (editable but never sent) is gone, along with a dead duplicate of the test-email function.',
  ],
}

export default note
