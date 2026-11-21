import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8194',
  date: '2026-11-21',
  title: 'Document builder: a link says where it stands and who opened it',
  kind: 'feature',
  highlights: [
    'The link card lists each open under Who opened it, with its day and time. A person with an account is named. Someone with no account is shown by where the open came from and their browser.',
    'A sheet’s link closes when the sheet is taken off the last trade’s page. A line under the trades says so before you press, and says when the link stays on.',
    'The card says the day a link went off and why: it closed with the last trade, or someone switched it off.',
    'The next send switches a link on again when it closed with the last trade. A link you switched off yourself stays off.',
  ],
}

export default note
