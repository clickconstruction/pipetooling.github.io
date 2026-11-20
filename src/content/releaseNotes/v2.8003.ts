import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8003',
  date: '2026-11-19',
  title: 'Before we start: a list on each stage of what must be true first',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator', 'primary', 'superintendent'],
  highlights: [
    'A job’s Documents tab has a new section, Before we start. Each stage keeps a short list of what must be true before the crew goes.',
    'One press ticks what the customer told you. The line then says who said it, how and the day, and each can be changed right there.',
    'A stage shows a ready bar and a percent, and four lines: our days, the day they say ready, the notice we need and the day we decide.',
    'A stage with no list offers four common bullets to start from. The office can keep its own starter for Rough In, Top Out and Trim Set.',
  ],
}

export default note
