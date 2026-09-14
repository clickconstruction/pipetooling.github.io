import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3388',
  date: '2026-09-14',
  title: 'Contract sweep: fix the scope and the amount without leaving the pane',
  kind: 'feature',
  highlights: [
    'Scope (one line per item) and Amount sit right above the agreement in the sweep. Type, and the document redraws as you go; the edits save to the job’s draft as you type — the same draft the send uses — so what you see is what goes out.',
    'A row that read “Scope is just the name” or “No amount” turns Ready the moment the scope says more or an amount is in, and Send & next lights up.',
    'Send flushes any unsaved edit first. A contract already out for signature is locked here; Void & redo lives in the full editor.',
  ],
}

export default note
