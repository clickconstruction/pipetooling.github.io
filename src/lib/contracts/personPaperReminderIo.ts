/**
 * Reminders by email for a staff or sub paper (punch list #376), their reads and writes from the app. The rules are
 * `supabase/functions/_shared/personPaperReminder.ts`, which the send and the timed function read too. The paper's
 * own switch is a write to its row, under the table's own policies: the four roles that send a paper. The Settings
 * switch is one `app_settings` row the owner and a dev may change. Browser io, not pure.
 */
import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { paperRemindersOn, PERSON_PAPER_REMINDERS_KEY, reminderSwitchPatch, type ReminderPaper } from '../../../supabase/functions/_shared/personPaperReminder'

// The reminder columns join the generated types with the types PR after the migration's push; until then the list is a plain string.
const REMINDER_COLUMNS: string = 'id, status, doc_type, person_name, signer_email, reminders_enabled, reminder_count, next_reminder_at'

/** What the Agreements tab knows about reminders: the Settings switch, and each waiting paper's own state. */
export type PaperReminders = { switchOn: boolean; byId: ReadonlyMap<string, ReminderPaper> }

export const NO_PAPER_REMINDERS: PaperReminders = { switchOn: false, byId: new Map() }

/** Whether the Settings switch is on. Throws with the reason. */
export async function readPaperRemindersSwitch(): Promise<boolean> {
  const row = await withSupabaseRetry(async () => supabase.from('app_settings').select('value_text').eq('key', PERSON_PAPER_REMINDERS_KEY).maybeSingle(), 'read the reminders switch')
  return paperRemindersOn((row as { value_text?: string | null } | null)?.value_text)
}

/** The switch and the reminder state of some papers, by id. Throws with the reason. */
export async function readPaperReminders(ids: readonly string[]): Promise<PaperReminders> {
  if (ids.length === 0) return NO_PAPER_REMINDERS
  const [switchOn, rows] = await Promise.all([
    readPaperRemindersSwitch(),
    withSupabaseRetry(async () => supabase.from('person_contract_documents').select(REMINDER_COLUMNS).in('id', [...ids]), 'read the reminders'),
  ])
  const byId = new Map<string, ReminderPaper>()
  for (const r of (rows ?? []) as unknown as Array<ReminderPaper & { id: string }>) byId.set(r.id, r)
  return { switchOn, byId }
}

/** Turn the Settings switch on or off. Throws with the reason, and when the row is not there to change. */
export async function writePaperRemindersSwitch(on: boolean): Promise<void> {
  const changed = await withSupabaseRetry(
    async () =>
      supabase
        .from('app_settings')
        .update({ value_text: on ? '1' : '0' })
        .eq('key', PERSON_PAPER_REMINDERS_KEY)
        .select('key'),
    'save the reminders switch',
  )
  if (!Array.isArray(changed) || changed.length === 0) throw new Error('The switch was not saved. Only the owner and a dev may change it.')
}

/** Turn one waiting paper's reminders on or off. Throws with the reason, and when the paper is no longer waiting. */
export async function writePaperReminderSwitch(documentId: string, turnOn: boolean): Promise<void> {
  const changed = await withSupabaseRetry(
    async () =>
      supabase
        .from('person_contract_documents')
        .update(reminderSwitchPatch(turnOn, Date.now()) as never)
        .eq('id', documentId)
        .eq('status', 'sent')
        .select('id'),
    turnOn ? 'turn the reminders on' : 'turn the reminders off',
  )
  if (!Array.isArray(changed) || changed.length === 0) throw new Error('The paper is no longer waiting on a signature. Read the list again.')
}
