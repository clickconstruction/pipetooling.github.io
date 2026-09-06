import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2913',
  date: '2026-09-05',
  title: 'Pipeline papercuts: found paid jobs say so, HouseCall Pro says what it does, call mode dials and escalates',
  kind: 'fix',
  highlights: [
    'Searching the Pipeline for a job that is Paid in Full no longer looks like the app lost it: a row above the board says "1 match in Paid in Full — show it", the Paid in Full header counts matches instead of saying "Expand to load", and if nothing matches anywhere the board says so — Paid in Full included. The Pipeline menu item "Weekly movement" is now "Stage moves this week" (the emailed report keeps its name), and the GC-statement card reads "1 GC statement waits on sign-off" — GCs, not rounds, verb agreeing.',
    'Bill Customer\'s HouseCall Pro channel now says on its face that it only records the bill — ClickTooling emails nobody and the customer sees nothing from there.',
    'A bill for what is left on a job no longer re-lists work the customer already paid for at odd half prices: segments the payments already cover drop off the bill and the remaining work lists at its real price (Stripe previews, physical PDFs and the Who-owes-what breakdown agree).',
    'Call mode shows the phone as (555) 123-4567, adds an ✉ email link when a bill actually went out by email, and — after two broken promises, or on a dispute — offers "Move … to Collections…" right there (the board\'s same typed confirm). A Collections job with nothing on a bill line now ages from the day it was flagged ("In Collections 30 days") instead of sitting un-ageable.',
  ],
}

export default note
