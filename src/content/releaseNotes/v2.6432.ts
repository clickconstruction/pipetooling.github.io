import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6432',
  date: '2026-11-03',
  title: 'Materials on site: the manifest and the box labels print at full size',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'superintendent', 'primary', 'helpers'],
  highlights: [
    'The manifest now prints at its full size. Before, the browser shrank it to about two thirds of the page, so the type was small and the foot of each sheet stayed blank.',
    'A manifest fills its Letter page again, with 11 ruled lines tall enough for a pen. Its QR code prints at its full size.',
    'Print labels prints every label at full size, each on its own sheet, as the window says. Before, the labels shared a sheet.',
  ],
}

export default note
