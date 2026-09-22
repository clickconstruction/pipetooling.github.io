import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3705',
  date: '2026-09-22',
  title: 'Every account control has one home: the roster, the desk, or Digital twins & samples',
  kind: 'feature',
  highlights: [
    'Settings → People & teams no longer carries the accounts table; it points to People → Users → Account, with Manage accounts… and Find duplicates… beside the pointer for the rare dev tools.',
    'The View-as sample accounts moved to Settings → System → Digital twins & samples, beside the other fixture accounts, with Create the missing samples there. They are never people: no roster row, no pay.',
    "The Users tab's Accounts · dev button and the Your account tab's All salaried users panel are gone — the Account lens and the Pay lens's Workday… button are where those lived.",
    'Guides updated: hire someone, invite someone to sign in, archive and restore user accounts, merge user accounts, put someone in read-only training mode, see the app as someone else, start here in the office.',
  ],
}

export default note
