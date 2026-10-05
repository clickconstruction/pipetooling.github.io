import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4581',
  date: '2026-10-05',
  title: 'Procurement log: four steps and a Next line at the top',
  kind: 'feature',
  highlights: [
    'The top of the log now shows four steps: Waiting on the GC, To order, On order and On site. Every part is counted once. Press a step to see only its parts.',
    'A Next line under the steps says what to do first. "Enter their approval…" sits at its end.',
    '"Before you can order" is one quiet line. Set… beside a count puts one lead time or one stage on all of those parts at once.',
    'Send update and + Add item moved to the top right. Print, CSV, Google Sheets and Updates sent are under the ⋯ button. Rows are no longer painted amber before the first update.',
  ],
}

export default note
