import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7879',
  date: '2026-11-18',
  title: 'Robots: an assistant can make a new robot account',
  kind: 'infra',
  highlights: [
    'A developer’s assistant can now make a robot account, as the mint button on Settings → Digital twins does.',
    'It names the kind only, a bid robot or the pricing robot. The seat number, the address and the name come from the fleet.',
    'A bid robot gets its CountTooling and TakeoffTooling seats in the same step, and each part is reported done or held.',
    'The new robot has no key and is read-only. Its key, its rung and Archive are still set by a developer.',
  ],
}

export default note
