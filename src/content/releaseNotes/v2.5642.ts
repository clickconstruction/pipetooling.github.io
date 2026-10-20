import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5642',
  date: '2026-10-19',
  title: 'Type /bill to put a customer’s bill in a message',
  kind: 'feature',
  highlights: [
    'In a text or an email to a customer, type /bill, /invoice, /pay or /owe. Under the quick replies, the list shows that customer’s bills: the open ones first, then the three newest paid ones.',
    'Pick a bill and a line about it goes in the box with its amount and its pay link. An open bill uses the team’s own bill line when there is one; a paid bill goes in as a copy.',
    'From a job’s window, that job’s bills come first. Nothing sends until you press Send.',
  ],
}

export default note
