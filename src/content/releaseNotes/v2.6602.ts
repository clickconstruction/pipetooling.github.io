import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6602',
  date: '2026-11-06',
  title: 'A photo on a task card: offered at each percent, asked at the finish',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'primary', 'estimator', 'subcontractor', 'helpers', 'superintendent'],
  highlights: [
    'The Where does it stand? sheet carries a photo tile. Take one and Set sends it first, then the percent; skip it and nothing waits. On a phone the camera opens; the photo shrinks on the device as a report photo does.',
    'A card that asks for a photo opens the finishing sheet when its last Done when… line is ticked or Done is pressed: the finishing photo, or a typed reason that frees the press and lands on the card’s notes. A card that does not ask closes as before.',
    'The card shows its photos as a strip, on its way until the sweep files it under the Tasks folder in Drive and in Drive once it has. Review’s sign-off row shows the finishing photo, so the office signs off on what it can see.',
  ],
}

export default note
