import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3259',
  date: '2026-09-10',
  title: 'Job Summary: overhead dials — smoothing, carry for open jobs, and one app-wide setting',
  kind: 'feature',
  highlights: [
    'Day-share now runs on three constants set once for the whole app: a smoothing window (each day’s office cost is shared by the field hours of the following weeks), a carry share (a slice every open job pays per day just for being open), and an idle cap (a job stops carrying after that many days with no field time).',
    'The grey chip beside the Overhead control names the constants in force. Devs see a gear on it: sliders and switches, a live strip showing the window’s pool tying to the dollar, and Use for everyone to set the app default. Turning a dial changes your device only until you save.',
    'Expand a job and open Overhead — the math: with carry on, every day line shows By hours and Carry, and the days the job was charged while nobody was on site are marked open, not worked.',
    'Two new chips under the totals: overhead that had nobody to charge, and overhead still in flight (spread past today; it lands as the days arrive). Until a dev sets the app default, everything reads exactly as before.',
  ],
}

export default note
