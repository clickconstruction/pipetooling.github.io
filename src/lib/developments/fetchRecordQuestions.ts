/**
 * A record's own questions (punch list #208 PR 4b): both lanes' requests that name this bid or this
 * job, and on a job those asked on the bid it came from, with the names of who asked and who
 * answered. The same reader the Development page uses (`readRequestsWhere`), under the reader's own
 * policies: the office team reads every question that names a record, everyone their own.
 */
import { readRequestsWhere, readUserNames } from './fetchDevelopmentPage'
import type { MemberRequest } from './overview'
import { recordQuestionsFilter, type RecordPiece } from './recordQuestions'

export type RecordQuestionsRead = { requests: MemberRequest[]; names: Map<string, string> }

export async function fetchRecordQuestions(piece: Pick<RecordPiece, 'kind' | 'id'>, fromBidId: string | null): Promise<RecordQuestionsRead> {
  const filter = recordQuestionsFilter(piece, fromBidId)
  const [estimators, dispatch] = await Promise.all([readRequestsWhere('estimators', filter), readRequestsWhere('dispatch', filter)])
  const requests = [...estimators, ...dispatch]
  const userIds = new Set<string>()
  for (const r of requests) {
    userIds.add(r.from_user_id)
    for (const n of r.notes) userIds.add(n.author_user_id)
  }
  const names = await readUserNames([...userIds])
  return { requests, names }
}
