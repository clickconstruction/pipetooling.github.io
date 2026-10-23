import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5784',
  date: '2026-10-23',
  title: 'Legal Desk: a Map of every Collections case, with the firm that covers each county',
  kind: 'feature',
  highlights: [
    'The Legal Desk has two views now, Accounts and Map, switched at the top right. Map shows the Texas counties colored by the law firm that covers each, and a dot per Collections account at its job’s address, sized by what it owes.',
    'The dot’s color says where the account stands: needs a dev’s eyes, with the firm, given up on, or in a county no firm covers. A red line over the map names the accounts no firm covers yet.',
    'Who covers what lists each firm with its counties, how many cases sit in them and how much is owed. Tap a county to list its cases on the card beside the map. Tap a dot or a case and the desk opens on that account.',
    'Scroll to zoom, drag to pan, Central Texas and All of Texas to reset, the same map as the county picker on Settings.',
  ],
}

export default note
