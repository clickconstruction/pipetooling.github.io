import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8148',
  date: '2026-11-20',
  title: 'Document builder: a tab left open can no longer save or publish over a newer draft',
  kind: 'fix',
  highlights: [
    'In the Sub NDA and in Insurance requirements for subs, your typing is saved only when nobody saved a newer draft since your page read it. A tab left open can no longer put old words out as the next revision.',
    'When someone did, a panel names what changed. What you typed stays on the page until you choose.',
    'Load the newer one takes their draft. Save mine over it saves yours. A revision someone published stays published either way.',
    'The publish button waits while the choice is open.',
  ],
}

export default note
