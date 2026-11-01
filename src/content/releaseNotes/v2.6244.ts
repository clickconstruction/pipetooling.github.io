import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6244',
  date: '2026-10-31',
  title: 'A dev’s agent drafts a sworn statement onto a collections account (punch list #220)',
  kind: 'feature',
  highlights: [
    'The dev MCP gains plan_matter_statement and apply_matter_statement: a robot drafts an affidavit or an unsworn declaration onto a legal matter’s Timeline, with the day it is about, who swears it, the form, the county and the paragraphs.',
    'The draft lands on the Said lane tagged dev MCP, as Draft · not signed. The office prints, signs and files it from Swear a statement… as before; the robot never prints, signs or files.',
    'A robot may change a draft it or the office made until the signed copy is filed. The sworn text is sworn.',
    'The older write verbs answer again: since the twin setup code shipped, plan_cost_batch through apply_history_entry had answered mint_twin_setup_code needs label.',
  ],
  roles: ['dev'],
}

export default note
