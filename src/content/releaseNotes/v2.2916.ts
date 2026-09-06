import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2916',
  date: '2026-09-05',
  title: 'Roadmap is its own page; Farm Mode says where you are and how to leave',
  kind: 'feature',
  highlights: [
    'Roadmap has its own header entry for the owner, masters, assistants, the controller, and primaries — the same people who could already edit roadmap tasks. Goals (stage progress, unlock banners, Remind, Reorder, the stage ledger) moved there from Checklist → Review; Checklist is the daily list again. Old Roadmap-tab links land on the new page.',
    'The Dashboard\'s "roadmap tasks need a person" card stays the owner\'s and now sits after the company\'s Needs-You items instead of ranking among lien deadlines and team reviews.',
    'Farm Mode shows a green "Farm Mode · Exit" strip at the top of the page — a shared tablet left in the mode no longer looks like a broken app, and Exit is one tap. The mode also closes the "/" people finder it used to leave open.',
  ],
}

export default note
