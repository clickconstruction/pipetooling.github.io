import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6280',
  date: '2026-11-01',
  title: 'The law firm sees a sample week of emails before adding a person',
  kind: 'feature',
  highlights: [
    'Under the Add a person card on the firm portal\'s Notifications tab, a sample week shows what lands in that person\'s inbox under the rule picked: seven subject lines under Each event, one line under Weekly digest. The accounts are made up and the caption says so.',
    'Press a line and that email opens under the list, the real one with its stop link in the footer. The first opens by itself.',
    'The fee line sits dim under Each event and reads weekly digest only, since a fee the office saw rides the digest alone. Under Weekly digest it is a line like the others.',
    'Only theirs narrows the week to the account handled by the person being added, so the firm sees what that rule means before pressing Send.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
}

export default note
