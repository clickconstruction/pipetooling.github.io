import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3589',
  date: '2026-09-18',
  title: "Stripe pay links stay live: every open bill's link is renewed nightly",
  kind: 'fix',
  highlights: [
    "Stripe retires a hosted pay link 30 days after the bill's due date, and the app kept handing out the link it saved on the day the bill was created — so a customer chased on an older bill landed on a \"link expired\" page. Every night the app now fetches the current link for every open Stripe bill and stores it.",
    "Nothing changes on the screens: the portal's Pay button, the Bill tab's Text · Copy link · Email, View bill and Collect payment all read the same stored link, which is now never more than a day old.",
    "Until tonight's first run, an old bill's link can still be dead — Send bill through Stripe on the row emails a fresh one right away.",
  ],
}

export default note
