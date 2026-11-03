import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6338',
  date: '2026-11-02',
  title: 'Find a file by what a file is about, not only the words it uses, once search by meaning is set up',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'Once the office sets up search by meaning, every file in the index gets a sense of what it is about, piece by piece. A search then finds the letter where the GC agreed to the extra rock even when the letter never says “agreed”.',
    'A hit found by meaning carries a quiet by meaning tag and shows the opening of the part that was nearest. A hit the words found keeps its bold line. The count line says files say or are about your words.',
    'Every ten minutes the sweep gives ten more files their sense, so the files indexed before the setup catch up on their own. Until the setup, Find a file works by the words exactly as before.',
    'When the index has only loose matches by meaning, Drive’s own search still runs behind them, so a file found by its exact name is never hidden.',
  ],
}

export default note
