// notify-note-tag (punch list #363, PR 5): the phone notice for a teammate tagged in a job note, and for the person
// who asked when the answer lands. Since punch list #375, PR 4, the same for a task note.
//
// The client calls it right after a typed note posts, with the note's id, and after a No reply needed press, with
// the tag's id. It sends no words. The function reads the rows with the service role, refuses unless the caller wrote
// that note (or is the tagged person who pressed), refuses a note or a press more than fifteen minutes old, and writes
// the title and the body itself in words.ts, so nobody can push arbitrary text to a teammate or replay an old note.
//
//   { note_id }        the people the job note tags: "Marcus tagged you on Cedar Bluff Lofts"
//                      the people whose tags it answered: "Dana answered on Cedar Bluff Lofts"
//   { tag_id }         the asker of a job tag cleared with no note: "Dana: no reply needed"
//   { task_event_id }  the same two for a task note (checklist_instance_events, kind comment): "Luis tagged you on
//                      Sweep the bays", "Dana answered on Sweep the bays". The tap lands on the Checklist.
//   { task_tag_id }    the asker of a task tag cleared with no note
//
// A note that tags nobody and answers nothing sends nothing and answers 200. A person's hours: every push goes
// through _shared/pushHoursSend.ts, which holds it for a person outside their Push me hours and writes the held row.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendPushHonouringHours } from '../_shared/pushHoursSend.ts'
import { webPushSender } from '../_shared/webPushSend.ts'
import { refuseArchivedCaller } from '../_shared/refuseArchivedCaller.ts'
import { recipientsNotShut } from '../_shared/jobPapersLock.ts'
import { donePush, notePushes, taskDonePush, taskNotePushes, type PushPerson, type TagPush } from './words.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/** A note or a press older than this pushes nothing: the call is for what just happened. */
const FRESH_MS = 15 * 60 * 1000

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

function fresh(iso: string | null | undefined): boolean {
  const at = iso ? Date.parse(iso) : NaN
  return Number.isFinite(at) && Date.now() - at <= FRESH_MS
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  try {
    const authHeader = req.headers.get('Authorization')
    const token = authHeader?.replace(/^Bearer\s+/i, '')
    if (!authHeader || !token) return json({ error: 'Unauthorized' }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!serviceRoleKey) return json({ error: 'SUPABASE_SERVICE_ROLE_KEY not configured' }, 500)

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })
    const { data: { user }, error: authError } = await userClient.auth.getUser(token)
    if (authError || !user) return json({ error: 'Unauthorized' }, 401)

    const { note_id, tag_id, task_event_id, task_tag_id } = (await req.json().catch(() => ({}))) as { note_id?: string; tag_id?: string; task_event_id?: string; task_tag_id?: string }
    if (!note_id && !tag_id && !task_event_id && !task_tag_id) return json({ error: 'Missing note_id, tag_id, task_event_id or task_tag_id' }, 400)

    const admin = createClient(supabaseUrl, serviceRoleKey)
    const archivedRefusal = await refuseArchivedCaller(admin, user.id, corsHeaders)
    if (archivedRefusal) return archivedRefusal

    const rolesOf = async (ids: readonly string[]): Promise<PushPerson[]> => {
      const unique = [...new Set(ids)].filter(Boolean)
      if (unique.length === 0) return []
      const { data } = await admin.from('users').select('id, role').in('id', unique)
      const role = new Map<string, string | null>((data ?? []).map((u: { id: string; role: string | null }) => [u.id, u.role]))
      return unique.map((userId) => ({ userId, role: role.get(userId) ?? null }))
    }

    let pushes: TagPush[] = []
    // The job the note sits on, for the papers lock below.
    let jobId: string | null = null

    // The task a day row belongs to, by its title as kept.
    const taskTitleOf = async (instanceId: string): Promise<string | null> => {
      const { data: inst } = await admin.from('checklist_instances').select('checklist_item_id').eq('id', instanceId).maybeSingle()
      if (!inst?.checklist_item_id) return null
      const { data: item } = await admin.from('checklist_items').select('title').eq('id', inst.checklist_item_id).maybeSingle()
      return item?.title ?? null
    }

    if (task_event_id) {
      const { data: note } = await admin.from('checklist_instance_events').select('id, instance_id, event_type, actor_user_id, body, created_at').eq('id', task_event_id).maybeSingle()
      if (!note || note.event_type !== 'comment' || note.actor_user_id !== user.id) return json({ error: 'Not your note' }, 403)
      if (!fresh(note.created_at)) return json({ success: true, push_sent: 0, message: 'The note is not new' })
      const [{ data: tags }, { data: answered }, { data: author }, taskTitle] = await Promise.all([
        admin.from('task_note_tags').select('tagged_user_id').eq('event_id', note.id).is('cleared_at', null),
        admin.from('task_note_tags').select('tagger_user_id').eq('answer_event_id', note.id),
        admin.from('users').select('name').eq('id', user.id).maybeSingle(),
        taskTitleOf(note.instance_id),
      ])
      pushes = taskNotePushes({
        eventId: note.id,
        noteBody: String(note.body ?? ''),
        taskTitle,
        authorName: author?.name ?? null,
        tagged: await rolesOf((tags ?? []).map((t: { tagged_user_id: string }) => t.tagged_user_id).filter((id: string) => id !== user.id)),
        askers: await rolesOf((answered ?? []).map((t: { tagger_user_id: string }) => t.tagger_user_id).filter((id: string) => id !== user.id)),
      })
    } else if (task_tag_id) {
      const { data: tag } = await admin
        .from('task_note_tags')
        .select('id, event_id, instance_id, tagged_user_id, tagged_name, tagger_user_id, cleared_at, cleared_how')
        .eq('id', task_tag_id)
        .maybeSingle()
      if (!tag || tag.tagged_user_id !== user.id) return json({ error: 'Not your tag' }, 403)
      if (tag.cleared_how !== 'done' || !fresh(tag.cleared_at)) return json({ success: true, push_sent: 0, message: 'Nothing new to say' })
      const [{ data: note }, taskTitle, [asker]] = await Promise.all([
        admin.from('checklist_instance_events').select('body').eq('id', tag.event_id).maybeSingle(),
        taskTitleOf(tag.instance_id),
        rolesOf([tag.tagger_user_id]),
      ])
      if (asker) pushes = [taskDonePush({ tagId: tag.id, noteBody: String(note?.body ?? ''), taskTitle, taggedName: tag.tagged_name, asker })]
    } else if (note_id) {
      const { data: note } = await admin.from('jobs_ledger_thread_notes').select('id, job_id, author_user_id, body, created_at').eq('id', note_id).maybeSingle()
      if (!note || note.author_user_id !== user.id) return json({ error: 'Not your note' }, 403)
      if (!fresh(note.created_at)) return json({ success: true, push_sent: 0, message: 'The note is not new' })
      jobId = note.job_id ?? null
      const [{ data: tags }, { data: answered }, { data: author }, { data: job }] = await Promise.all([
        admin.from('jobs_ledger_note_tags').select('tagged_user_id').eq('note_id', note.id).is('cleared_at', null),
        admin.from('jobs_ledger_note_tags').select('tagger_user_id').eq('answer_note_id', note.id),
        admin.from('users').select('name').eq('id', user.id).maybeSingle(),
        admin.from('jobs_ledger').select('job_name').eq('id', note.job_id).maybeSingle(),
      ])
      pushes = notePushes({
        noteId: note.id,
        noteBody: String(note.body ?? ''),
        jobName: job?.job_name ?? null,
        authorName: author?.name ?? null,
        tagged: await rolesOf((tags ?? []).map((t: { tagged_user_id: string }) => t.tagged_user_id).filter((id: string) => id !== user.id)),
        askers: await rolesOf((answered ?? []).map((t: { tagger_user_id: string }) => t.tagger_user_id).filter((id: string) => id !== user.id)),
      })
    } else {
      const { data: tag } = await admin
        .from('jobs_ledger_note_tags')
        .select('id, note_id, job_id, tagged_user_id, tagged_name, tagger_user_id, cleared_at, cleared_how')
        .eq('id', tag_id)
        .maybeSingle()
      if (!tag || tag.tagged_user_id !== user.id) return json({ error: 'Not your tag' }, 403)
      if (tag.cleared_how !== 'done' || !fresh(tag.cleared_at)) return json({ success: true, push_sent: 0, message: 'Nothing new to say' })
      jobId = tag.job_id ?? null
      const [{ data: note }, { data: job }, [asker]] = await Promise.all([
        admin.from('jobs_ledger_thread_notes').select('body').eq('id', tag.note_id).maybeSingle(),
        admin.from('jobs_ledger').select('job_name').eq('id', tag.job_id).maybeSingle(),
        rolesOf([tag.tagger_user_id]),
      ])
      if (asker) pushes = [donePush({ tagId: tag.id, noteBody: String(note?.body ?? ''), jobName: job?.job_name ?? null, taggedName: tag.tagged_name, asker })]
    }

    if (pushes.length === 0) return json({ success: true, push_sent: 0, held: 0 })

    const sender = webPushSender(admin, 'notify-note-tag')
    let devices = 0
    let held = 0
    for (const push of pushes) {
      // Papers before a job opens: the push names the job, so a person who still owes that job a paper is left out of
      // it (the app's Papers to sign line tells them instead); a push with nobody left is not sent.
      const userIds = await recipientsNotShut(admin, jobId, push.userIds)
      if (userIds.length === 0) continue
      // Through the person's hours: pushed now, or held with a row and no push.
      const result = await sendPushHonouringHours(admin, { ...push, userIds }, sender)
      devices += result.devices
      held += result.held.length
    }
    return json({ success: true, push_sent: devices, held })
  } catch (error) {
    console.error('Error in notify-note-tag:', error)
    return json({ error: (error as Error)?.message || 'Internal server error' }, 500)
  }
})
