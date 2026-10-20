import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5159',
  date: '2026-10-10',
  title: 'GC mode: a trade partner reports its work and signs its changes in its portal',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'A trade partner picks each line’s percent done in its portal. The pick never goes below what we paid through.',
    'It signs a change we sent it, with a typed name and the e-sign consent. The change becomes a line of its statement of work.',
    'With the email tick on, Send the change now emails the trade to sign it in its portal.',
  ],
}

export default note
