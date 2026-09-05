import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2809',
  date: '2026-09-04',
  title: 'People → Users: hours are a queue, not an alarm',
  kind: 'feature',
  highlights: [
    'The attention dot on People → Users now reflects paperwork and account gaps only; clock sessions waiting for approval no longer turn a person amber.',
    'A new Hours to approve filter lists everyone with sessions waiting, so the approval pass is one tap.',
    'Paperwork chips follow the person, not the spelling of their name.',
  ],
}

export default note
