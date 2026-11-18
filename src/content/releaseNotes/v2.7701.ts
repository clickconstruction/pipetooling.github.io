import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7701',
  date: '2026-11-17',
  title: 'Trips: start a trip from the phone, join one, head home and end it',
  kind: 'feature',
  highlights: [
    'Job Mode now asks one question after you clock in on a job at a site far from the shop: is this a trip? Press Start a trip, join a crewmate’s trip, or press Just clock in. Your hours are the same either way.',
    'While your trip is open, the job’s card shows a green banner with the trip’s number, the day of the trip, who is with you and when it started. Each day you clock in at that site is added to your trip by itself. A day you drive in reads On the road until you press I’m here.',
    'Heading home on the banner marks today as On the road. End the trip shows your days at the site and on the road, with a box for how it went that you can skip.',
    'The question comes after the clock in has gone through, so no answer and no failed press can hold up your hours. The office can change or delete a phone trip like any other.',
  ],
}

export default note
