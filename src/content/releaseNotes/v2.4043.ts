import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4043',
  date: '2026-09-28',
  title: 'GC Review: where a GC’s checks went is figured in one tested place',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'The first piece of "Where the checks went": the rule that folds a GC’s payments back into the checks they came from, names the bill on each job a check sits on now, keeps the trail when a payment was moved, and rolls each job up to billed, paid by, last applied, retainage held and still open.',
    'Nothing on screen changes yet. The line under each bill, Find a check and the printable sheet follow on this rule.',
  ],
}

export default note
