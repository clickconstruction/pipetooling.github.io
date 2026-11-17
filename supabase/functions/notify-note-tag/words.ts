// notify-note-tag: the words and the door of each push (punch list #363, PR 5, and task notes since #375, PR 4).
// Pure, with no Deno call, so src/lib/jobs/noteTagPush.test.ts runs it. The function in index.ts reads the rows and
// hands the facts here.

/** One person a push goes to, with the role that decides where its tap lands. */
export interface PushPerson {
  userId: string
  role: string | null
}

/** One push as `_shared/pushHoursSend.ts` takes it. */
export interface TagPush {
  userIds: string[]
  title: string
  body: string
  url: string
  tag: string
  templateType: 'note_tag' | 'task_note_tag' | 'note_tag_answer'
}

/** A note just posted: who it tags, and whose tags it answers. */
export interface NotePushFacts {
  noteId: string
  noteBody: string
  jobName: string | null
  authorName: string | null
  /** The people this note tags, still waiting. */
  tagged: readonly PushPerson[]
  /** The people whose tags on the job this note answered. */
  askers: readonly PushPerson[]
}

/** A No reply needed press: one tag cleared with no note. */
export interface DonePushFacts {
  tagId: string
  noteBody: string
  jobName: string | null
  taggedName: string | null
  asker: PushPerson
}

const OFFICE_ROLES: readonly string[] = ['dev', 'master_technician', 'assistant', 'controller']

/** Where the tap lands: the Pipeline for the office, whose section is there, and the Dashboard for everyone else. */
export function pushUrlFor(role: string | null): string {
  return role != null && OFFICE_ROLES.includes(role) ? '/jobs?tab=stages' : '/dashboard'
}

export function firstName(name: string | null | undefined): string {
  const n = (name ?? '').trim()
  return n ? n.split(/\s+/)[0]! : 'A teammate'
}

/** The note's words cut to fit a phone's notice, on a word where one is near. */
export function clip(text: string, max = 140): string {
  const t = text.replace(/\s+/g, ' ').trim()
  if (t.length <= max) return t
  const cut = t.slice(0, max - 1)
  const at = cut.lastIndexOf(' ')
  return `${(at > max * 0.6 ? cut.slice(0, at) : cut).trimEnd()}…`
}

function jobWords(jobName: string | null): string {
  return (jobName ?? '').trim() || 'a job'
}

/** One push per door: the people who share where the tap lands get one call. Nobody is pushed twice or pushes themselves. */
function byDoor(people: readonly PushPerson[], skip: ReadonlySet<string>): Map<string, string[]> {
  const out = new Map<string, string[]>()
  const seen = new Set<string>(skip)
  for (const p of people) {
    if (!p.userId || seen.has(p.userId)) continue
    seen.add(p.userId)
    const url = pushUrlFor(p.role)
    const list = out.get(url)
    if (list) list.push(p.userId)
    else out.set(url, [p.userId])
  }
  return out
}

/**
 * The pushes for a note just posted. The people it tags read *Marcus tagged you on Cedar Bluff Lofts*. The people
 * whose tags it answered read *Dana answered on Cedar Bluff Lofts*. A person who is both, asked and now tagged
 * back, gets the tag alone: it is the one that waits on them.
 */
export function notePushes(f: NotePushFacts): TagPush[] {
  const who = firstName(f.authorName)
  const job = jobWords(f.jobName)
  const body = clip(f.noteBody)
  const pushes: TagPush[] = []
  const taggedIds = new Set(f.tagged.map((p) => p.userId))
  for (const [url, userIds] of byDoor(f.tagged, new Set())) {
    pushes.push({ userIds, title: `${who} tagged you on ${job}`, body, url, tag: `note-tag-${f.noteId}`, templateType: 'note_tag' })
  }
  for (const [url, userIds] of byDoor(f.askers, taggedIds)) {
    pushes.push({ userIds, title: `${who} answered on ${job}`, body, url, tag: `note-tag-answer-${f.noteId}`, templateType: 'note_tag_answer' })
  }
  return pushes
}

/** The push for a No reply needed press: the asker reads who pressed it and on which note. */
export function donePush(f: DonePushFacts): TagPush {
  return {
    userIds: [f.asker.userId],
    title: `${firstName(f.taggedName)}: no reply needed`,
    body: `${jobWords(f.jobName)}: ${clip(f.noteBody, 110)}`,
    url: pushUrlFor(f.asker.role),
    tag: `note-tag-done-${f.tagId}`,
    templateType: 'note_tag_answer',
  }
}

// ---------- task notes (punch list #375) ----------

/** A task note just posted: who it tags, and whose tags on that task it answered. */
export interface TaskNotePushFacts {
  eventId: string
  noteBody: string
  /** The task's title as it is kept, job token and all. */
  taskTitle: string | null
  authorName: string | null
  tagged: readonly PushPerson[]
  askers: readonly PushPerson[]
}

/** A No reply needed press on a task tag. */
export interface TaskDonePushFacts {
  tagId: string
  noteBody: string
  taskTitle: string | null
  taggedName: string | null
  asker: PushPerson
}

/** Where a task tag's tap lands, for every role: the Checklist's Today, where the Tagged task notes section is. */
export const TASK_PUSH_URL = '/checklist?tab=today'

/**
 * A task's title as plain words. A task sent from a job keeps the job in its title as a token,
 * `{{1:1466 · Cedar Bluff Lofts}} — Sweep the bays`, which the app draws as a chip. A phone's notice draws no chip,
 * so the token's own words are kept and its braces dropped. This function cannot import src/lib, so the rule of
 * `taskTitlePlain` (src/lib/tasks/taskPlace.ts) is written again here, and the test holds the two together.
 */
export function taskTitleWords(title: string | null | undefined): string {
  const plain = (title ?? '').replace(/\{\{\d+:([^}]*)\}\}/g, '$1').replace(/\s+/g, ' ').trim()
  return plain || 'a task'
}

/** The people to push, once each, without anyone in `skip`. Every role lands on the Checklist, so it is one call. */
function once(people: readonly PushPerson[], skip: ReadonlySet<string>): string[] {
  const seen = new Set<string>(skip)
  const out: string[] = []
  for (const p of people) {
    if (!p.userId || seen.has(p.userId)) continue
    seen.add(p.userId)
    out.push(p.userId)
  }
  return out
}

/**
 * The pushes for a task note just posted. The people it tags read *Luis tagged you on Sweep the bays*. The people
 * whose tags it answered read *Dana answered on Sweep the bays*. A person who is both gets the tag alone.
 */
export function taskNotePushes(f: TaskNotePushFacts): TagPush[] {
  const who = firstName(f.authorName)
  const task = clip(taskTitleWords(f.taskTitle), 60)
  const body = clip(f.noteBody)
  const pushes: TagPush[] = []
  const tagged = once(f.tagged, new Set())
  const askers = once(f.askers, new Set(tagged))
  if (tagged.length > 0) pushes.push({ userIds: tagged, title: `${who} tagged you on ${task}`, body, url: TASK_PUSH_URL, tag: `task-note-tag-${f.eventId}`, templateType: 'task_note_tag' })
  if (askers.length > 0) pushes.push({ userIds: askers, title: `${who} answered on ${task}`, body, url: TASK_PUSH_URL, tag: `task-note-tag-answer-${f.eventId}`, templateType: 'note_tag_answer' })
  return pushes
}

/** The push for a No reply needed press on a task tag: the asker reads who pressed it and on which note. */
export function taskDonePush(f: TaskDonePushFacts): TagPush {
  return {
    userIds: [f.asker.userId],
    title: `${firstName(f.taggedName)}: no reply needed`,
    body: `${clip(taskTitleWords(f.taskTitle), 60)}: ${clip(f.noteBody, 110)}`,
    url: TASK_PUSH_URL,
    tag: `task-note-tag-done-${f.tagId}`,
    templateType: 'note_tag_answer',
  }
}
