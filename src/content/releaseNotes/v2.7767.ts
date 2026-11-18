import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7767',
  date: '2026-11-18',
  title: 'Checklist: Manage’s parts are sorted by tested rules',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Behind the scenes, the rules that sort Manage’s library into its parts moved out of the tab into the tested rules file beside it.',
    'Nothing changes on screen. Open one-offs, scheduled ones, repeating tasks and finished ones land in the same parts, in the same order.',
    'Ten new tests hold those rules, so a later change to a part cannot quietly move a task.',
  ],
}

export default note
