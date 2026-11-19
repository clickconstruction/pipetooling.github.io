import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7934',
  date: '2026-11-19',
  title: 'Robots: an assistant can set who the robots are graded against',
  kind: 'infra',
  highlights: [
    'A developer’s assistant can now make a person a calibration standard, or lift it, as the Calibration standard card in Settings → Digital twins does.',
    'Before anything changes it names the standards before and after, and how many scored robot bids would start or stop counting toward the gate.',
    'It warns when no standard would be left, and when a new one would stand beside another.',
    'A robot, an archived person and a role that sends no bids cannot be made a standard, as on the card.',
  ],
}

export default note
