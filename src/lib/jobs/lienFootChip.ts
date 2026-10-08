/**
 * The chip at the left of a notice pane's footer (v2.4855, the owner's pick of variant A): the
 * state in a few words — who approved and when, since when it waits, when it printed, why it is
 * held — with the whole old sentence as the chip's hover. Pure: the footers draw what this says.
 */
import { wordRecordWords } from './lienWord'
import { demandDate } from '../jobsDocuments/demandLetter'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'

export type LienFootChipTone = 'green' | 'blue' | 'amber'

export type LienFootChip = {
  tone: LienFootChipTone
  /** "Approved · leader’s word · Oct 7" */
  words: string
  /** The sentence the footer used to say, for the hover. */
  title: string
}

export type LienFootChipItem = {
  approval_mode?: string | null
  approved_at?: string | null
  word_note?: string | null
  word_channel?: string | null
  submitted_at?: string | null
  printed_at?: string | null
  hold_reason?: string | null
  hold_until?: string | null
}

/** "Oct 7" from an instant (company calendar) or a day. */
export function shortDay(iso: string | null | undefined): string {
  const ymd = /^\d{4}-\d{2}-\d{2}$/.test(iso ?? '') ? iso! : calendarYmdInAppTzFromIso(iso ?? '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ''
  return new Date(`${ymd}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

function longDay(iso: string | null | undefined): string {
  const ymd = /^\d{4}-\d{2}-\d{2}$/.test(iso ?? '') ? iso! : calendarYmdInAppTzFromIso(iso ?? '')
  return /^\d{4}-\d{2}-\d{2}$/.test(ymd) ? demandDate(ymd) : ''
}

/** The office’s awaiting footer: with the leader since the day it went to him. */
export function awaitingChip(item: LienFootChipItem | null | undefined): LienFootChip {
  const day = shortDay(item?.submitted_at)
  return { tone: 'blue', words: `Waiting on the leader${day ? ` · since ${day}` : ''}`, title: `Waiting on the leader since ${longDay(item?.submitted_at) || '—'}.` }
}

/** The ready footer: approved on the leader’s word, by the GC’s standing rule, or by the leader on a day; the offer rides along. */
export function readyChip(item: LienFootChipItem | null | undefined, gcName: string | null | undefined, offerWords: string | null | undefined, leaderName?: string | null): LienFootChip {
  const offer = offerWords ? ` · ${offerWords}` : ''
  if (item?.approval_mode === 'word') {
    const day = shortDay(item.approved_at)
    return { tone: 'green', words: `Approved · leader’s word${day ? ` · ${day}` : ''}${offer}`, title: `On ${wordRecordWords({ word_note: item.word_note ?? null, word_channel: item.word_channel ?? null }, leaderName).slice(3)}${offer} · in the run.` }
  }
  if (item?.approval_mode === 'rule') {
    const gc = gcName?.trim() || 'the GC'
    return { tone: 'green', words: `Approved · ${gc}’s standing rule${offer}`, title: `Approved by ${gc}'s standing rule${offer} · in the run.` }
  }
  const day = shortDay(item?.approved_at)
  const long = longDay(item?.approved_at)
  return { tone: 'green', words: `Approved${day ? ` · ${day}` : ''}${offer}`, title: `Approved${long ? ` ${long}` : ''}${offer} · in the run.` }
}

/** The printed footer: the day the packet printed; the run is where its number is typed. */
export function printedChip(item: LienFootChipItem | null | undefined): LienFootChip {
  const day = shortDay(item?.printed_at)
  const long = longDay(item?.printed_at)
  return { tone: 'blue', words: `Printed${day ? ` ${day}` : ''} · in the mail`, title: `Printed${long ? ` ${long}` : ''} · in the mail. Type its tracking numbers in the run to record it.` }
}

/** The held footer: why, and the day it asks again. */
export function heldChip(item: LienFootChipItem | null | undefined, gcName: string | null | undefined): LienFootChip {
  const why = item?.hold_reason === 'promised' ? 'they promised' : item?.hold_reason === 'rule' ? `${gcName?.trim() || 'the GC'}’s standing rule` : 'the leader will call first'
  const day = shortDay(item?.hold_until)
  const long = longDay(item?.hold_until)
  return { tone: 'amber', words: `Held · ${why}${day ? ` · asks again ${day}` : ''}`, title: `Held — ${why} · asks again ${long || '—'}.` }
}
