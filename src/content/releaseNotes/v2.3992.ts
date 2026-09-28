import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3992',
  date: '2026-09-28',
  title: 'Contracts & terms: each card says what last went out',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'Six cards on Settings → Contracts & terms now carry a Last sent line: the job service agreement, the bid terms and exclusions, the estimate’s Terms box and agreement sentence, and the electronic-signature consent. It is read from the copy the app kept when it sent.',
    'The line says whether what went out is the wording on the card. When it is not, it turns amber, and the top of the tab counts those cards.',
    'For the job service agreement it also counts unsent drafts, and agreements out for signature, that still carry older wording.',
    'Compare what went out puts that copy in a column of its own, beside today’s wording.',
  ],
}

export default note
