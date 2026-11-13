import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7043',
  date: '2026-11-12',
  title: 'Pipeline: a billed row’s lien line names the next thing to do',
  kind: 'feature',
  highlights: [
    'The lien line on a billed row now names the next step, not only the deadline. It reads Find the owner by Nov 16, Draft the affidavit by Nov 16 or Waiting on Robert by Nov 16, with the days left beside it.',
    'An affidavit held by one missing fact says which: Answer the homestead question, Add the GC’s address. Public property says no lien attaches and who to ask, with no day to race.',
    'The day always comes from the lien clock, so the row and the Lien desk’s Deadlines never show two days. A step that is not urgent is a quiet ring. A step that is urgent is bold.',
    'A closed window is one short line, Lien gone with its day. The underlined words on a lien line are the press, and its tip is three short sentences.',
  ],
}

export default note
