import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4130',
  date: '2026-09-29',
  title: 'Pipeline Billed rows: the line under the bar tells the bill’s story',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'primary'],
  highlights: [
    'On Billed and Collections rows the words under the bar now read “Billed Sep 15 · 21 d past expected · they said Oct 3” instead of the crew’s hours line, which was written for Working rows.',
    'Click the expectation itself (“expect ~Oct 6” or “21 d past expected”) to record what the customer said, or a new date once one is on record — the separate They said… link and the expected-pay pill are gone.',
    'One colour rule: plain inside the window the customer’s own pay history predicts, amber once past it or past a promise, red in Collections. Hours never colour a Billed row.',
    'The action column keeps only its buttons; “Open 3 weeks” no longer shows on Billed and Collections rows.',
  ],
}

export default note
