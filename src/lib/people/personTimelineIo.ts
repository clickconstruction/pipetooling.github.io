import { supabase } from '../supabase'
import { loadPersonEvidence } from './personEvidenceIo'
import type { PersonEvidenceRecord } from './personEvidence'
import type {
  PersonTimelineContract,
  PersonTimelineEntry,
  PersonTimelineExcuse,
  PersonTimelineInput,
  PersonTimelineLicense,
  PersonTimelineNcns,
  PersonTimelinePerson,
  PersonTimelineReport,
  PersonTimelineSource,
  PersonTimelineWriteup,
} from './personTimeline'
import { formatErrorMessage } from '../../utils/errorHandling'

/**
 * Gathers the person file's sources under the viewer's own RLS, each read on its own and
 * fail-soft: a source the viewer's role may not open is skipped and named in `held`, a read
 * that fails is named the same way, and the rest of the file still draws. The kernel
 * (`personTimeline.ts`) turns what comes back into the line.
 */

export type PersonFileViewer = { isDev: boolean; canAccessContracts: boolean; canAccessLicenses: boolean }

export type PersonFileDoc = { kind: string; content: string; updated_at: string; covered_through: string | null; author_label: string | null }

export type PersonFileAttachment = {
  id: string
  person_id: string
  entry_id: string | null
  /** Null since v2.6541 for a file kept only as a Drive link; an older bucket file always has one. */
  storage_path: string | null
  filename: string
  mime_type: string | null
  size_bytes: number | null
  author_label: string | null
  uploaded_by: string | null
  created_at: string
}

export type PersonTimelineHeld = { source: PersonTimelineSource; reason: string }

export type PersonFileSources = {
  input: PersonTimelineInput
  docs: { summary?: PersonFileDoc; narrative?: PersonFileDoc }
  /** Files written before evidence records, or attached straight to an entry: the bucket copy is the only one. */
  attachments: PersonFileAttachment[]
  /** The evidence records, each with its files (`personEvidence.ts`). */
  evidence: PersonEvidenceRecord[]
  held: PersonTimelineHeld[]
}

type Res<T> = { data: T[] | null; error: { message: string } | null }

export async function loadPersonFileSources(args: {
  personId: string | null
  userId: string | null
  personName: string
  viewer: PersonFileViewer
  todayYmd: string
}): Promise<PersonFileSources> {
  const { personId, userId, personName, viewer, todayYmd } = args
  const held: PersonTimelineHeld[] = []
  const name = personName.trim()

  async function read<T>(source: PersonTimelineSource, allowed: boolean, why: string, run: () => PromiseLike<Res<T>>): Promise<T[]> {
    if (!allowed) {
      held.push({ source, reason: why })
      return []
    }
    try {
      const r = await run()
      if (r.error) {
        held.push({ source, reason: r.error.message })
        return []
      }
      return r.data ?? []
    } catch (e) {
      held.push({ source, reason: formatErrorMessage(e) })
      return []
    }
  }

  const devOnly = 'dev only'
  const noRoster = 'needs a roster row'
  const noLogin = 'needs a login'

  const evidenceLoad = viewer.isDev && personId ? loadPersonEvidence(personId) : Promise.resolve({ records: [] as PersonEvidenceRecord[], heldWhy: null as string | null })
  const [personRows, entries, attachments, docRows, reports, contractsById, contractsByName, licenses, writeupRows, ncns, excuseRows] = await Promise.all([
    read<PersonTimelinePerson>('employment', Boolean(personId), noRoster, () =>
      supabase.from('people').select('id, name, start_date, end_date, archived_at').eq('id', personId as string),
    ),
    read<PersonTimelineEntry>('file', viewer.isDev && Boolean(personId), personId ? devOnly : noRoster, () =>
      supabase.from('person_file_entries').select('id, entry_date, content, source, created_by, created_at, author_label').eq('person_id', personId as string),
    ),
    read<PersonFileAttachment>('file', viewer.isDev && Boolean(personId), personId ? devOnly : noRoster, () =>
      supabase
        .from('person_file_attachments')
        .select('id, person_id, entry_id, storage_path, filename, mime_type, size_bytes, author_label, uploaded_by, created_at')
        .eq('person_id', personId as string)
        .order('created_at', { ascending: false }),
    ),
    read<PersonFileDoc>('file', viewer.isDev && Boolean(personId), personId ? devOnly : noRoster, () =>
      supabase.from('person_files').select('kind, content, updated_at, covered_through, author_label').eq('person_id', personId as string),
    ),
    read<PersonTimelineReport>('report', viewer.isDev && Boolean(personId), personId ? devOnly : noRoster, () =>
      supabase
        .from('person_reports')
        .select('id, status, occurred_date, created_at, author_name, content, resolution_note, resolved_at, filed_entry_id')
        .eq('subject_person_id', personId as string),
    ),
    read<PersonTimelineContract>('contract', viewer.canAccessContracts && Boolean(personId), 'contracts are office work', () =>
      supabase
        .from('person_contract_documents')
        .select('id, document_name, status, created_at, sent_at, signed_at, office_completed_at, signer_printed_name, expires_at, doc_type')
        .eq('person_id', personId as string),
    ),
    read<PersonTimelineContract>('contract', viewer.canAccessContracts && name !== '', 'contracts are office work', () =>
      supabase
        .from('person_contract_documents')
        .select('id, document_name, status, created_at, sent_at, signed_at, office_completed_at, signer_printed_name, expires_at, doc_type')
        .eq('person_name', name),
    ),
    read<PersonTimelineLicense>('license', viewer.canAccessLicenses && name !== '', 'licenses need the pay gate', () =>
      supabase.from('person_licenses').select('id, license_type, date_of_expiry, created_at, note').eq('person_name', name),
    ),
    read<{ id: string; template_id: string; status: string; disclosure: string | null; submitted_at: string | null; created_at: string; filled_by_user_id: string | null }>(
      'writeup',
      viewer.canAccessContracts && Boolean(userId),
      userId ? 'write-ups are office work' : noLogin,
      () => supabase.from('writeups').select('id, template_id, status, disclosure, submitted_at, created_at, filled_by_user_id').eq('subject_user_id', userId as string),
    ),
    read<PersonTimelineNcns>('attendance', viewer.canAccessContracts && Boolean(userId), userId ? 'attendance is office work' : noLogin, () =>
      supabase
        .from('attendance_incidents')
        .select('id, work_date, created_at, created_by_user_id, details')
        .eq('subject_user_id', userId as string)
        .eq('incident_type', 'no_call_no_show'),
    ),
    read<{ id: string; work_date: string; note: string; created_at: string; author: unknown }>(
      'attendance',
      viewer.canAccessContracts && Boolean(userId),
      userId ? 'attendance is office work' : noLogin,
      () =>
        (supabase as unknown as import('@supabase/supabase-js').SupabaseClient)
          .from('attendance_annotations')
          .select('id, work_date, note, created_at, author:users!attendance_annotations_author_id_fkey(name)')
          .eq('subject_user_id', userId as string) as unknown as PromiseLike<Res<{ id: string; work_date: string; note: string; created_at: string; author: unknown }>>,
    ),
  ])

  const evidence = await evidenceLoad
  if (evidence.heldWhy) held.push({ source: 'evidence', reason: evidence.heldWhy })
  const evidenceFileIds = new Set(evidence.records.flatMap((r) => r.files.map((f) => f.id)))

  // The same copy can answer both contract reads (person_id and person_name): keep one.
  const contracts = new Map<string, PersonTimelineContract>()
  for (const c of [...contractsById, ...contractsByName]) contracts.set(c.id, c)

  // Template names for the write-ups, and display names for every id a row names.
  const templateIds = [...new Set(writeupRows.map((w) => w.template_id))]
  const userIds = new Set<string>()
  for (const e of entries) if (e.created_by) userIds.add(e.created_by)
  for (const r of evidence.records) if (r.created_by) userIds.add(r.created_by)
  for (const w of writeupRows) if (w.filled_by_user_id) userIds.add(w.filled_by_user_id)
  for (const n of ncns) if (n.created_by_user_id) userIds.add(n.created_by_user_id)
  const [templates, users] = await Promise.all([
    templateIds.length > 0 ? supabase.from('writeup_templates').select('id, name').in('id', templateIds) : Promise.resolve({ data: [] as Array<{ id: string; name: string }>, error: null }),
    userIds.size > 0 ? supabase.from('users').select('id, name').in('id', [...userIds]) : Promise.resolve({ data: [] as Array<{ id: string; name: string | null }>, error: null }),
  ])
  const templateName = new Map((templates.data ?? []).map((t) => [t.id, t.name]))
  const namesById: Record<string, string> = {}
  for (const u of (users.data ?? []) as Array<{ id: string; name: string | null }>) if (u.name) namesById[u.id] = u.name

  const writeups: PersonTimelineWriteup[] = writeupRows.map((w) => ({
    id: w.id,
    template_name: templateName.get(w.template_id) ?? 'Write-up',
    status: w.status,
    disclosure: w.disclosure,
    submitted_at: w.submitted_at,
    created_at: w.created_at,
    filled_by_user_id: w.filled_by_user_id,
  }))
  // PostgREST types a to-one embed as an array; the row carries one author or none.
  const authorName = (a: unknown): string | null => {
    const one = Array.isArray(a) ? a[0] : a
    return one && typeof one === 'object' && typeof (one as { name?: unknown }).name === 'string' ? ((one as { name: string }).name) : null
  }
  const excuses: PersonTimelineExcuse[] = excuseRows.map((x) => ({ id: x.id, work_date: x.work_date, note: x.note, created_at: x.created_at, author_name: authorName(x.author) }))

  const docs: PersonFileSources['docs'] = {}
  for (const d of docRows) {
    if (d.kind === 'summary') docs.summary = d
    else if (d.kind === 'narrative') docs.narrative = d
  }

  // A held source is named once, even when two reads share it.
  const seen = new Set<string>()
  const heldOnce = held.filter((h) => {
    const k = `${h.source}:${h.reason}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })

  return {
    input: {
      todayYmd,
      person: personRows[0] ?? null,
      entries,
      // Every file the line can show: the older bucket-only files, and each evidence record's files on the entry it proves.
      attachments: [
        ...attachments.filter((a) => !evidenceFileIds.has(a.id)).map((a) => ({ id: a.id, entry_id: a.entry_id })),
        ...evidence.records.flatMap((r) => r.files.map((f) => ({ id: f.id, entry_id: r.entry_id }))),
      ],
      evidence: evidence.records.map((r) => ({
        id: r.id,
        entry_id: r.entry_id,
        dated_on: r.dated_on,
        title: r.title,
        memo: r.memo,
        created_at: r.created_at,
        created_by: r.created_by,
        author_label: r.author_label,
        drive_folder_url: r.drive_folder_url,
        fileIds: r.files.map((f) => f.id),
      })),
      reports,
      contracts: [...contracts.values()],
      licenses,
      writeups,
      ncns,
      excuses,
      namesById,
    },
    docs,
    attachments: attachments.filter((a) => !evidenceFileIds.has(a.id)),
    evidence: evidence.records,
    held: heldOnce,
  }
}
