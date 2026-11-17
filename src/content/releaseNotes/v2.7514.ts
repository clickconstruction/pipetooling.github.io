import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7514',
  date: '2026-11-16',
  title: 'Lien notices: the pay codes page names the cover letter only when one is enclosed',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'The pay codes page told the owner to hold the money back from the builder, as the cover letter asks. It said so even when no cover letter was in the envelope: a notice with the cover letter box unticked, and every notice printed from the job’s Lien window.',
    'The page now names the cover letter only when one prints in front of it. Without one, the sentence ends at the builder’s name.',
    'The Lien desk’s own view of the page follows the cover letter box, so what you read on the desk is what prints.',
  ],
}

export default note
