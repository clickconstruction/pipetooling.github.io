import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5061',
  date: '2026-10-09',
  title: 'Division 22 codes: add, change and delete rules and sections',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'On the Rules tab, Add a rule makes a new rule, and each rule has Edit and Delete. Before you save, the form lists the names whose code would change and the coverage before and after.',
    'The form stops a rule with no pattern, a section that does not exist, or the same words as another rule. It warns when a rule shares its order with one that catches the same names.',
    'On the Sections tab you can add a section and rename one. A section that still holds rules cannot be deleted, and the message says how many it holds.',
    'A deleted rule or section can be put back for 90 days from Recently deleted.',
  ],
}

export default note
