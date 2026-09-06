import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2908',
  date: '2026-09-05',
  title: 'Settings and admin papercuts: plain names, shown reasons, a clear exit, a lighter Release notes tab',
  kind: 'fix',
  highlights: [
    'Recently deleted\'s type filter says "Job invoices" and "Bid rooms" instead of raw table names, and deleted bid rooms (with their revisions and sign/decline history) are now archived and restorable like the rest of a bid.',
    'Merge users explains itself: under the "merge away" list, "Why isn\'t an account listed?" names each left-out account and the rule it fails — from Active Accounts or the Person Desk\'s Manage account… door.',
    'The impersonation exit button now reads "Exit impersonation (Bryan)" ("Exit (Bryan)" on phones) instead of just the person\'s name.',
    'Release notes load 15 at a time behind "Show earlier updates" and can hide notes meant for other roles; Settings → Email templates & testing links to the project workflow Templates page; a dead invite link now says to re-run Invite via email.',
  ],
}

export default note
