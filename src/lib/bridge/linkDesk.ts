/**
 * The link's desk (link PR 2): what each link is, why it matters to
 * throughput, how the Bridge reads it, and the moves the week would make on
 * it. Static words per link; the numbers come from the page at call time
 * (`CallMove.then`, keyed so Friday can read them again). Pure.
 */
import type { CallLink, MoveKey } from './calls'

export type DeskMovePreset = { key: MoveKey; title: string }

export type LinkDeskText = {
  what: string
  why: string
  how: string
  moves: DeskMovePreset[]
}

export const LINK_DESK: Record<CallLink, LinkDeskText> = {
  market: {
    what: 'People asking us for work: GCs inviting us to bid, and customers asking for an estimate.',
    why: 'With no demand nothing downstream can turn. When Market is the link, every other fix is wasted motion.',
    how: 'Demand in per week: bids opened and estimates requested, by value. The prospect list is not on this card until it produces something the app can see.',
    moves: [
      { key: 'other', title: 'Put a value on every bid invited, so demand is measured in dollars.' },
      { key: 'other', title: 'Ask the GCs who invite us what else they are bidding.' },
      { key: 'other', title: 'Decide the prospect list’s fate: feed it, work it, or close it.' },
    ],
  },
  sales: {
    what: 'Bids and estimates out, and the share that come back as sold work.',
    why: 'Demand we already paid to get, leaking. Sales is the link when wins feed the field less than it can build.',
    how: 'Sent per week and won per week by value, bids and estimates together, and what waits on an answer.',
    moves: [
      { key: 'other', title: 'Date the won bids, or count them by sent month, so wins read by week.' },
      { key: 'other', title: 'Close out the bids older than 90 days as lost, so the pile is real.' },
      { key: 'other', title: 'Put values on the bids sent with none.' },
      { key: 'other', title: 'Work Followup on the live bids by their day.' },
    ],
  },
  build: {
    what: 'Sold work the field has not finished.',
    why: 'This is where contribution is made. If Build is the link, the field sets the company’s pace. Only more hours or better rates move it.',
    how: 'Built per week is each job’s change in percent complete times its contract. Sold per week is the contract on jobs created. The pile is the contract left on open jobs.',
    moves: [
      { key: 'pct', title: 'Set a percent on the open jobs without one.' },
      { key: 'price', title: 'Put a contract value on the open jobs that have none.' },
      { key: 'other', title: 'Hold the schedule to what billing can turn, not to what was sold.' },
    ],
  },
  bill: {
    what: 'Finished work becoming a bill. Nothing is money until this stage runs.',
    why: 'Work finished and unbilled is inventory: effort spent, nothing earned. Every week this stage runs slower than the field, the pile grows and cash waits on it.',
    how: 'Finished work not yet billed. On each working job that is the percent done times the contract, less what is billed or paid. A ready-to-bill job counts its whole remainder. A job with no percent takes the newest field report. A job with neither reads as half done and is drawn grey. Bills a week by the day they went out, or the day they were marked billed. The biller’s week.',
    moves: [
      { key: 'bill', title: 'Bill the finished work.' },
      { key: 'other', title: 'Take bank sorting off whoever bills, so billing is never idle.' },
      { key: 'price', title: 'Price the unpriced jobs, so what is billed is right.' },
      { key: 'other', title: 'Schedule no more finished work than billing can turn this week.' },
    ],
  },
  collect: {
    what: 'Bills becoming money in the bank.',
    why: 'The last link before cash. A bill unpaid is a loan to the customer. The late ones are where the forecast leans.',
    how: 'Owed to you, invoices past their expected day, collected per week, the receipts band under the cash chart.',
    moves: [
      { key: 'chase', title: 'Chase the late invoices in pace order.' },
      { key: 'other', title: 'Ask for a pay date on each. Promises firm up the forecast.' },
      { key: 'other', title: 'Hand the oldest two to the Lien desk.' },
    ],
  },
  decision: {
    what: 'Things only one person can decide, and the pile of them.',
    why: 'A decision nobody else can make stops every stage downstream of it. The cheapest constraint to fix and the hardest to see, because it never looks busy.',
    how: 'What waits on the owner and how old it is: hours, prices, percents, bank rows, bids with no value.',
    moves: [
      { key: 'approve', title: 'Approve the hours waiting on the schedule.' },
      { key: 'price', title: 'Price the unpriced jobs this week.' },
      { key: 'other', title: 'Hand bank sorting to someone who is not the biller.' },
    ],
  },
  capital: {
    what: 'Cash to pay payroll and suppliers on their dates.',
    why: 'A breached floor stops everything at once. Capital is the one resource that fails the whole chain on a single day.',
    how: 'The bank’s balance, the forecast’s lowest point against the floor, how sure the receipts are.',
    moves: [
      { key: 'chase', title: 'Collect: the same moves as the link.' },
      { key: 'other', title: 'Delay what can wait. Spend nothing on other links.' },
      { key: 'other', title: 'If the link moves and cash still breaks the floor, this becomes the link.' },
    ],
  },
  talent: {
    what: 'The hours and skills to do the work at each stage.',
    why: 'Hours are the raw material of throughput. Too few at a stage starve the chain. Too many at another pile up work the next stage cannot turn.',
    how: 'Field hours against backlog, who bills and how much of their week is billing, open seats.',
    moves: [
      { key: 'other', title: 'Give the biller a clear week: no bank rows, no phones on Tuesday.' },
      { key: 'other', title: 'Hold field hiring until the link moves.' },
      { key: 'other', title: 'If exploiting is not enough, elevate: a second biller for a month.' },
    ],
  },
}
