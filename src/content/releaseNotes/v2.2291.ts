import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2291',
  date: '2026-08-25',
  title: 'Adding a stage no longer yanks the map away',
  kind: 'fix',
  highlights: [
    'Placing a stage on the Roadmap Map used to re-layout the whole graph and zoom the camera out to fit — you lost your spot after every add.',
    'Now nothing moves but the stage you added: right-click puts it exactly where you pointed, the toolbar button drops it in the middle of your current view, and it glows blue for a moment so it\'s unmissable.',
    'Deleting a stage holds still the same way. The Organize button is unchanged — it\'s still the explicit "tidy the whole map up" action.',
  ],
}

export default note
