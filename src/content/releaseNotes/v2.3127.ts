import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3127',
  date: '2026-09-08',
  title: 'Multiple Segment Generator: every segment says its stage kind, and change orders get their own price',
  kind: 'feature',
  highlights: [
    'Each generator row has the same Order / Any / — selector as the line items. The Commercial and Residential presets fill in-order stages, numbered top to bottom.',
    'A new + Change order preset adds an Any-time row with its own price outside the percentage split. The allocation line reads the split and the money outside it; the summary counts the kinds and the job total.',
    'Add to Job appends the segments with their stage already set — nothing to flip afterward.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'primary'],
}

export default note
