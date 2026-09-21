import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3668',
  date: '2026-09-21',
  title: 'Put a GC on notice: read each notice before you approve the run',
  kind: 'feature',
  highlights: [
    'In Step 2, click a row, any of its months, Preview beside the job, or Preview all — the job’s notice opens over the window. One notice per job names all of its months; the month you clicked is ringed.',
    'It shows what the run will print as the window stands now: the owner’s copy (the cover letter filled with that job’s address and months, then the notice — or the standard cover note if the letter is unticked) or the GC’s copy (the notice alone), and who each is mailed to.',
    'The arrows walk the whole run without closing. Esc closes only the preview — the window underneath keeps its place, the letter you were editing and the ticks.',
  ],
}

export default note
