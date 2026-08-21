import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.1974',
  date: '2026-08-21',
  title: 'Edge drift check catches stale code, not just missing functions',
  kind: 'infra',
  highlights: [
    'The daily edge-function drift check now also fails when a function was edited in the repo after its last deploy — the gap that let three notification functions run four-month-old code.',
    'Those three (dispatch/estimator request pushes and report notifications) were redeployed: push notifications now use the trade-aware job numbers and the Status Report name.',
  ],
}

export default note
