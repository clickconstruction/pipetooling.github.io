import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { createDispatchRequest } from '../dispatchRequestHelpers'
import { QUICKFILL_QUESTION_ACTION, questionRequestPayload, questionRequestReference, questionRequestTitle } from './markOutcome'

/**
 * The request a Not sure press files (punch list #176, change 1): one open Dispatch inbox
 * request per station, titled with the station, its count and the words typed, the station's
 * own question as the reference line. A second press on a station whose question is still
 * open adds nothing; the owner answers the one row.
 */
export type FileQuickfillQuestionArgs = {
  fromUserId: string
  sectionId: string
  label: string
  count: number | null
  question: string | null
  words: string
}

export type FileQuickfillQuestionResult = 'filed' | 'already-open'

export async function fileQuickfillQuestion(args: FileQuickfillQuestionArgs): Promise<FileQuickfillQuestionResult> {
  const existing = await withSupabaseRetry<{ id: string } | null>(
    async () =>
      supabase
        .from('dispatch_requests')
        .select('id')
        .eq('pending_action', QUICKFILL_QUESTION_ACTION)
        .eq('status', 'open')
        .eq('pending_payload->>sectionId', args.sectionId)
        .limit(1)
        .maybeSingle(),
    'check open quickfill question',
  )
  if (existing?.id) return 'already-open'
  await createDispatchRequest({
    fromUserId: args.fromUserId,
    title: questionRequestTitle(args.label, args.count, args.words),
    referenceSummary: questionRequestReference(args.question),
    pendingAction: QUICKFILL_QUESTION_ACTION,
    pendingPayload: questionRequestPayload({ sectionId: args.sectionId, label: args.label, count: args.count, question: args.question }),
  })
  return 'filed'
}
