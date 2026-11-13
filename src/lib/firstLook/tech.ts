/**
 * A tech reads one look before a job exists (punch list #319 PR 7). The office presses **Ask a tech…** on the look's
 * card, which opens Add a task with the look on it, the way a thread is sent as a task (`messages/threadTask.ts`). The
 * task's link opens the tech's page for that one look, where the tech answers one of two ways with a note. Pure: the
 * words, the page's address and the task's preset.
 */
import type { ChecklistJobPreset } from '../checklistJobPreset'
import type { ThreadLook } from './card'

/** The tech's page for one look. */
export const FIRST_LOOK_READ_PATH = '/first-look/:id'

export function firstLookReadHref(lookId: string): string {
  return `/first-look/${lookId}`
}

export type TechRead = 'can_price' | 'needs_visit'

export const TECH_READ_WORDS = {
  ask: 'Ask a tech…',
  askTip: 'Opens Add a task with this look on it. Whoever gets the task can open this one look, and nothing else of the thread.',
  /** What the task says when the office types nothing. */
  taskTitle: 'Can you price this from the photos?',
  asked: (dayWords: string) => `A tech was asked ${dayWords}. No answer yet.`,
  can_price: 'I can price it from this',
  needs_visit: 'Needs a visit to price',
  noteLabel: 'A note for the office',
  notePlaceholder: 'What you see, what it likely needs, what to bring.',
  send: 'Send my answer',
  sent: 'The office has your answer.',
  pickFirst: 'Pick one of the two answers first.',
  notYours: 'This look is not yours to see, or it is gone.',
  notYoursHint: 'A look opens for the office, for the tech it was asked of, and for the crew of the job made from it.',
  pageHead: 'First look',
  pageAsk: 'The office asked for your read before this goes on a schedule.',
  readOnly: 'Only the tech it was asked of answers here.',
  /** The look has no file yet: the customer may only have written, or not opened the link. */
  noFiles: 'The customer has not sent a photo or a video yet. Their words are below when they wrote any.',
} as const

/** The tech's answer as the office reads it: *Luis: I can price it from this. Bring a 3/4 inch stop.* */
export function techReadLine(look: { tech_read?: string | null; tech_note?: string | null; tech_read_name?: string | null }): string | null {
  if (look.tech_read !== 'can_price' && look.tech_read !== 'needs_visit') return null
  const who = look.tech_read_name?.trim().split(/\s+/)[0]
  const note = look.tech_note?.trim()
  return `${who ? `${who}: ` : ''}${TECH_READ_WORDS[look.tech_read]}.${note ? ` ${note}` : ''}`
}

/** The card's line about the tech: the answer, else that one was asked, else nothing. */
export function techLine(look: { tech_read?: string | null; tech_note?: string | null; tech_read_name?: string | null; asked_tech_at?: string | null }, day: (iso: string) => string): string | null {
  return techReadLine(look) ?? (look.asked_tech_at ? TECH_READ_WORDS.asked(day(look.asked_tech_at)) : null)
}

const clip = (s: string, max: number): string => (s.length <= max ? s : `${s.slice(0, max - 1).trimEnd()}…`)

/**
 * Add a task's preset for a look: the bar reads *First look* and the person with where the problem is, and link [1]
 * is the tech's page for the look. The title starts as the question, for the office to change.
 */
export function lookTaskPreset(contact: { name: string }, look: Pick<ThreadLook, 'id' | 'place' | 'words'>, origin: string): { title: string; links: string[]; job: ChecklistJobPreset } {
  const path = firstLookReadHref(look.id)
  const about = look.place?.trim() || look.words?.trim() || ''
  const job: ChecklistJobPreset = {
    id: look.id,
    number: 'First look',
    name: clip(`${contact.name.trim() || 'A customer'}${about ? ` · ${about.replace(/\s+/g, ' ')}` : ''}`, 80),
    trade: null,
    address: null,
    customer: null,
    path,
    url: `${origin}${path}`,
  }
  return { title: TECH_READ_WORDS.taskTitle, links: [job.url], job }
}
