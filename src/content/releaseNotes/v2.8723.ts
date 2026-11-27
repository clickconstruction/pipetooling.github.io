import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8723',
  date: '2026-11-27',
  title: 'The Bridge: mark a Build job as waiting, with a reason',
  kind: 'feature',
  highlights: [
    'On the Build desk, a quiet job’s row has Name why it waits. Pick one of six reasons, such as the GC is not ready for us, and press Mark it waiting.',
    'The job leaves the quiet list and its money. Its dollars show in a tile of their own, so nothing hides. The Build card still counts it as sold work.',
    'Lift the wait puts the job back. Each change writes a line on the job’s Activity with your name and the day.',
    'A waiting job wears a chip on its card on Jobs → Stages, so dispatch reads why it has no crew.',
  ],
}

export default note
