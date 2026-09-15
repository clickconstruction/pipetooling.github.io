import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3450',
  date: '2026-09-15',
  title: 'Owner of record: Bill Customer and the Lien desk read the roll',
  kind: 'feature',
  highlights: [
    'Bill Customer’s Send-to block shows the appraisal roll’s owner of record on a GC job that has none — “Use” saves it on the property so the lien notice can be mailed when it is due; it never holds up the bill.',
    'The Lien desk’s “Needs the owner” pane shows the roll’s answer with its provenance and Use in place; “Find the owner ›” stays as the fallback.',
    'A public owner (a city, county, school district or the State) is never drafted — the desk says the remedy is a claim on the GC’s payment bond.',
    'Settings → Jobs & billing gains “Save owners from the appraisal roll automatically” (off): every night the roll’s answer is saved as unconfirmed, the desk drafts on it, and a person confirms before Record the run.',
  ],
}

export default note
