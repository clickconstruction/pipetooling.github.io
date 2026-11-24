import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8434',
  date: '2026-11-24',
  title: 'GC projects: take an award back while its statement of work is a draft',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'Compare quotes now has Take the award back… beside Awarded. A window asks first and says what goes, and its button reads Take the award back.',
    'The award comes off and the drafted statement of work is deleted with it. The quote and the ask stay, and the trade can be awarded again.',
    'The press is off once the statement of work was sent or signed, with the reason under it.',
    'The take-back refuses in words when a pay application, a change, a paper, a submittal or anything else stands on the award. The company’s Activity keeps a note of who took it back and when.',
  ],
}

export default note
