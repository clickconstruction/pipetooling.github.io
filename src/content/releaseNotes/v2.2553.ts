import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2553',
  date: '2026-09-01',
  kind: 'feature',
  title: 'Audit cockpit v2 — judge the differences, coach the robot',
  highlights: [
    'The audit card now shows a true robot-vs-ours diff: rows are name-matched across both naming styles and sorted into what the robot missed, what it added, and where quantities disagree — biggest dollars first.',
    'Every difference takes a one-tap verdict — Robot’s wrong / Our record’s off / Both fine — that posts a tagged note the robot digests automatically. A system scoreboard (waste, water, gas, med-gas, fixtures) gives the 10-second read.',
    'The card opens with the robot’s own "Where I’m least sure" confession, and a coaching-record strip shows what your past notes became.',
    'Sealed shadow audits now hold completely behind a 🔒 until our own bid goes out — even seeing the robot’s takeoff early could anchor your number.',
  ],
}

export default note
