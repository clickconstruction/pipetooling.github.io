import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3461',
  date: '2026-09-15',
  title: 'Pipeline: click a stage to open Bill; the words line reads “Worked Aug 11 · 100% Aug 20”',
  kind: 'feature',
  highlights: [
    'On the Progress & payment cell, every stage chip and the bar itself now open the job’s Bill window at ① Line Items — where stages are named, ordered and priced. The small “Set stages” link under the bar is gone; click the bar instead.',
    'The line under the bar now reads “Worked Aug 11 · 100% Aug 20” instead of “on site Aug 11 · 100% typed Aug 20”. Hover the bar to see where the percent came from (typed, reported or set).',
  ],
}

export default note
