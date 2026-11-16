// notify-note-tag: the words and the door of each push (punch list #363, PR 5). Pure, with no Deno call, so
// src/lib/jobs/noteTagPush.test.ts runs it. The function in index.ts reads the rows and hands the facts here.

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
  templateType: 'note_tag' | 'note_tag_answer'
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
