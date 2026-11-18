import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7719',
  date: '2026-11-17',
  title: 'Pipeline: every group’s list takes what the groups share as one piece',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Behind the scenes, the Pipeline hands each group’s list what all the groups share as one named piece. Before, it handed over some sixty separate values to every list.',
    'Nothing changes on screen. Every row, card, button and chip works as before.',
    'New tests cover the rows the follow-up cards draw, in every stage, on the desk and on Mobile cards.',
  ],
}

export default note
