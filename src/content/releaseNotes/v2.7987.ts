import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7987',
  date: '2026-11-19',
  title: 'HR files: an assistant keeps a plan for your yes, and any session can apply it',
  kind: 'infra',
  highlights: [
    'A developer’s assistant can keep a plan on a person’s HR file for a yes. The plan shows on People → HR under Waiting on you.',
    'Any session can read the plans that wait and apply one on your word. The session that made it no longer has to be open.',
    'A plan that was applied leaves the list by itself. A plan the file has moved past is marked stale, with why.',
    'A plan can be dropped with a reason. There is still no Apply press in the app.',
  ],
}

export default note
