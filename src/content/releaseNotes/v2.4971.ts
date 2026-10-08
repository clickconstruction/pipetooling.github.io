import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4971',
  date: '2026-10-08',
  title: 'Lien desk: the run prints a checklist, a divider before each envelope, and holds what cannot be mailed',
  kind: 'feature',
  roles: ['master_technician', 'assistant', 'controller', 'dev'],
  highlights: [
    'Page 1 of the packet is now a checklist written to the person at the desk: one row per envelope with the name and address as the envelope reads them, what is inside, three ticks, and a tracking box the width of the row.',
    'A divider page sits before each envelope: a black band along the top so it shows in the stack, the envelope’s face as the printer prints it, the number large, what follows, the ticks and the tracking box. It stays on the desk.',
    'Every page that goes out carries a small foot naming the job, whose copy it is, and the document’s place in the copy, so a loose sheet finds its envelope.',
    'An envelope with no mailing address, or a notice with nothing to claim, is held back and listed in red with the reason instead of printed. The run’s numbers match the paper.',
  ],
}

export default note
