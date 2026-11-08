import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6674',
  date: '2026-11-07',
  title: 'A reply in Messages closes the courtesy notice',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'When the GC or the owner of record writes back in Messages after a courtesy notice went, the Lien desk now reads it as their answer: the footer says they answered and the day, the Reminders strip moves the notice to Closed, and the Dashboard’s lien month agrees. Until now a reply changed nothing and the reminder stayed on step 1.',
    'Any line back counts, on whichever of their numbers or addresses it comes in on, including a thread the office never texted from. A line older than the last courtesy does not.',
    'The guide’s What closes it now says a reply closes it.',
  ],
}

export default note
