import type { NoteTagRow, TaggablePerson } from '../jobs/noteTags'

/**
 * Ask a master (punch list #396, PR 2). The pace card gave a superintendent a reading and nothing to do with a
 * doubt about it. This press sends his question to the master on the job, with the card's numbers attached, so
 * the master does not have to ask what he is looking at.
 *
 * It is not a new kind of thing. It posts a job note that tags the master, through the tagged job notes of
 * punch list #363: the note waits on the master until he types an answer or presses **No reply needed**, and
 * the answer comes back to the asker under **You asked**. This file is who is asked, what the note says and
 * every word on the window. Pure.
 */

/**
 * Who the question can go to, best first: the masters on this job, then, when the job names none he can tag,
 * the masters in the office. Never the asker himself.
 */
export function mastersToAsk(people: ReadonlyArray<TaggablePerson>, askerId: string | null | undefined): TaggablePerson[] {
  const masters = people.filter((p) => p.role === 'master_technician' && p.userId !== askerId)
  const onJob = masters.filter((p) => p.onJob)
  const pool = onJob.length > 0 ? onJob : masters
  return [...pool].sort((a, b) => a.name.localeCompare(b.name))
}

/** The first name, for a press and a line of prose: *Send to Dana*. */
export function askFirstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name.trim()
}

/** What the card knows, to ride with the question. Any part can be missing. */
export type AskMasterFacts = { pct: number | null; hoursWords: string | null; finishWords: string | null; /** The stage in hand on the rail, when the job has stages. */ stage?: string | null }

/** The numbers in one line: *25% done, 9 of 70 h, finish Fri, Nov 20*. Empty when the card has none. */
export function askMasterFactsLine(f: AskMasterFacts): string {
  return [f.pct != null ? `${Math.round(f.pct)}% done` : null, f.hoursWords, f.finishWords ? `finish ${f.finishWords}` : null].filter((s): s is string => !!s).join(', ')
}

/** The quick questions, as chips. A press puts the words in the box, where he can change them before sending. */
export function askMasterQuickQuestions(f: AskMasterFacts): string[] {
  return [f.pct != null ? `Is ${Math.round(f.pct)}% right?` : 'What should the percent read?', f.stage ? `What counts as done on ${f.stage}?` : 'What counts as done on this stage?', f.finishWords ? 'The planned finish looks wrong.' : 'When should this job finish?']
}

/** The note as it is posted on the job: his question, then the card's numbers on their own line. */
export function askMasterNoteBody(question: string, f: AskMasterFacts): string {
  const q = question.trim()
  const facts = askMasterFactsLine(f)
  return facts ? `${q}\n${ASK_MASTER_WORDS.factsLead} ${facts}.` : q
}

/** Whether Send has something to send and someone to send it to. */
export function askMasterReady(question: string, to: TaggablePerson | null): boolean {
  return question.trim().length > 0 && to != null
}

/** The latest question this person asked on the job, for the card's one line. */
export type AskedLine = { words: string; waiting: boolean }

/** How long an answer stays on the card after it lands. */
export const ASKED_ANSWER_SHOWN_DAYS = 3

/**
 * The card's line about his own question: *Waiting on Dana.* while the tag is open, *Dana answered.* for a few
 * days after, then nothing. A tag cleared with **No reply needed** says that. Rows are the job's tags; only the
 * asker's own count, and the newest one speaks.
 */
export function askedLine(rows: ReadonlyArray<NoteTagRow>, askerId: string | null | undefined, nowMs: number): AskedLine | null {
  if (!askerId) return null
  const mine = rows.filter((r) => r.taggerUserId === askerId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const latest = mine[0]
  if (!latest) return null
  const name = askFirstName(latest.taggedName)
  if (!latest.clearedAt) return { words: `Waiting on ${name}.`, waiting: true }
  const age = nowMs - Date.parse(latest.clearedAt)
  if (!Number.isFinite(age) || age > ASKED_ANSWER_SHOWN_DAYS * 86_400_000) return null
  return { words: latest.clearedHow === 'done' ? `${name} said no reply is needed.` : `${name} answered. Open this job to read it.`, waiting: false }
}

export const ASK_MASTER_WORDS = {
  press: 'Ask a master',
  title: 'Ask the master on this job',
  /** The window's label for a screen reader. */
  label: 'Ask a master about this job',
  toLead: 'To',
  placeholder: 'Does rough-in include the roof drains?',
  boxLabel: 'Your question',
  factsLead: 'Pace card:',
  sentWith: 'Sent with:',
  send: (name: string): string => `Send to ${askFirstName(name)}`,
  sending: 'Sending',
  sent: (name: string): string => `Sent to ${askFirstName(name)}. The answer shows under You asked, on Jobs.`,
  reading: 'Reading who is on this job.',
  nobody: 'This job has no master you can ask yet. The office names one on the job.',
  failed: 'The question was not sent',
} as const
