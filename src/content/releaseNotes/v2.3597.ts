import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3597',
  date: '2026-09-18',
  title: 'Bids → Labor: one book per trade — no picker, a Hours-from chip on every entry, Reset to robot, and calibration a leader confirms',
  kind: 'feature',
  highlights: [
    "The labor book picker is gone: a bid prices on its trade's 🤖 Robot Default, and the line under the tiles names it with its counts. New book and Edit book are gone with it — a book is not a thing a person names any more.",
    "Every entry in the Labor book panel wears a Hours from chip — robot · human · override (with the person's name and date) · learned (from which bid) · calibrated — and an override offers Reset to robot, which brings the robot's own numbers back.",
    'Who may change the book: dev and master technicians set and reset anything; estimators override entries under their own name, reset their own, and propose a calibration; assistants and the controller read.',
    'Book vs jobs → Set now writes the multiplier onto the robot entries the linked jobs touched as calibrated overrides that never touch a person\'s number; an estimator\'s Set is a proposal on the tile until a leader confirms or clears it.',
  ],
}

export default note
