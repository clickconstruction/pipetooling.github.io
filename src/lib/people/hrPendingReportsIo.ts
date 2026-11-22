/**
 * Filing a field report (punch list #410): the one call both presses make, the queue's **File to the record** on
 * People, HR and the same press on a person's Timeline line. A write-up sent from the Dashboard's sheet is filed with
 * its facts ahead of the writer's words (`reportEntryBody`), so the entry reads the same whichever press filed it. A
 * report from before the sheet has no facts, and `file_person_report` writes its own preamble as it always did.
 *
 * Photos (PR 5): a write-up's photos are read by its press and, once the entry is made, saved as one evidence record
 * on the person's file, tied to that entry, through the same door the Evidence view uses (`savePersonEvidence`). The
 * record takes the next exhibit number like any other. A filing that answers *already* makes no second record.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { formatErrorMessage } from '../../utils/errorHandling'
import { reportEntryBody, type PendingReportFacts } from './hrPendingReports'
import { savePersonEvidence } from './personEvidenceIo'
import { writeUpKindLabel } from './writeUp'
import { photoCountWords, writeUpEvidenceDraft } from './writeUpPhotos'
import { reportPhotoFiles } from './writeUpPhotosIo'

const db = supabase as unknown as SupabaseClient

/** The columns a pending report's card and its filing words read. */
export const PENDING_REPORT_COLUMNS =
  'id, subject_person_id, author_user_id, author_name, occurred_date, content, created_at, kind, job_label, occurred_time, author_role, author_saw_it, author_on_job, seen_by, talked_to_person, adds_to, pressed_at, press_id'

type FiledFacts = PendingReportFacts & { subject_person_id?: string | null; press_id?: string | null }

export interface FiledReport {
  error: unknown | null
  /** What became of the write-up's photos: `none` when it had none, `made` with how many, or `failed` with why. */
  photos: { kind: 'none' } | { kind: 'made'; count: number } | { kind: 'failed'; why: string }
}

/** The words after a filing, for the toast. */
export function filedWords(filed: FiledReport, lead: string): string {
  if (filed.photos.kind === 'made') return `${lead} ${photoCountWords(filed.photos.count)} became an evidence record on the file.`
  if (filed.photos.kind === 'failed') return `${lead} The photos did not become an evidence record: ${filed.photos.why}`
  return lead
}

/**
 * Files one waiting report. `known` is the row when the caller already holds its facts; without it the row is read
 * first. A read that fails files the report anyway, with the function's own preamble: the words are never lost.
 */
export async function filePersonReport(reportId: string, subjectName: string, known?: FiledFacts, authUserId?: string | null): Promise<FiledReport> {
  let facts: FiledFacts | null = known ?? null
  if (!facts) {
    const { data } = await db.from('person_reports').select(PENDING_REPORT_COLUMNS).eq('id', reportId).maybeSingle()
    facts = (data as FiledFacts | null) ?? null
  }
  const body = facts ? reportEntryBody(facts, subjectName) : null
  const { data, error } = await db.rpc('file_person_report', body ? { p_report_id: reportId, p_content: body } : { p_report_id: reportId })
  if (error) return { error, photos: { kind: 'none' } }
  const answer = (data && typeof data === 'object' ? data : {}) as { already?: unknown; entry_id?: unknown }
  if (answer.already === true || !facts?.press_id || !facts.subject_person_id) return { error: null, photos: { kind: 'none' } }
  try {
    const files = await reportPhotoFiles(facts.press_id)
    if (files.length === 0) return { error: null, photos: { kind: 'none' } }
    const saved = await savePersonEvidence({
      personId: facts.subject_person_id,
      draft: writeUpEvidenceDraft(facts, writeUpKindLabel(facts.kind), files.length),
      files,
      entryId: typeof answer.entry_id === 'string' ? answer.entry_id : null,
      authUserId: authUserId ?? null,
    })
    return saved.ok ? { error: null, photos: { kind: 'made', count: files.length } } : { error: null, photos: { kind: 'failed', why: saved.why } }
  } catch (e) {
    return { error: null, photos: { kind: 'failed', why: formatErrorMessage(e, 'The photos could not be read.') } }
  }
}
