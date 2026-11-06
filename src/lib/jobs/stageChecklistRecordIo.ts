/**
 * The record's io (punch list #237, PR 3): a job's records off `stage_checklist_records` (migration 20261106050000) and
 * the office's Amend through `amend_stage_checklist_record`. The database files a record by itself at the last answer,
 * so there is no write to file one here; the screens take this io so their tests run over a fake.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { checkSupabaseError } from '../../utils/errorHandling'
import { recordFromRow, type ChecklistRecord, type RecordRowDb } from './stageChecklistRecord'

// The table is younger than the generated types; the types PR after the push removes this cast.
const db = supabase as unknown as SupabaseClient

const RECORD_COLS = 'id, job_id, fixture_id, record_no, version, record_id, stage_name, stage_kind, state, filed_at, filed_by_name, snapshot, answer_count, signed_count, no_count, amended_at, amended_by_name, amend_why, pdf_file_name, pdf_drive_file_id, pdf_filed_at, pdf_fail_why'

/** Every record on the job, every version, newest first. */
export async function loadJobRecords(jobId: string): Promise<ChecklistRecord[]> {
  const result = await db.from('stage_checklist_records').select(RECORD_COLS).eq('job_id', jobId).order('version', { ascending: false })
  checkSupabaseError(result, 'read the checklist records')
  return ((result.data ?? []) as RecordRowDb[]).map(recordFromRow)
}

/** Amend: the filed record reads amended with its reason and comes back; the stage is open again. */
export async function amendRecord(recordId: string, why: string): Promise<ChecklistRecord> {
  const result = await db.rpc('amend_stage_checklist_record', { p_record_id: recordId, p_why: why.trim() })
  checkSupabaseError(result, 'amend the record')
  return recordFromRow(result.data as RecordRowDb)
}
