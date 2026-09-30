import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4228',
  date: '2026-09-30',
  title: 'Pricing: the Workbench walkthrough in plain words',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'estimator', 'controller'],
  highlights: [
    'The five stops of the Workbench walkthrough are rewritten in short sentences, the way the Submittals walkthrough reads: one idea each, what this is, what you do, what happens after.',
    'Trade words get a plain word beside them the first time: a packet is what one GC gets, margin is profit as a share of the price, a preview is a price you have not saved yet.',
    'Every stop names the control by its exact name, so you can find ＋ Add GC, ☆ make base, Apply, Solver › and the 📌 pin from the words alone.',
  ],
}

export default note
