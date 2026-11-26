import { useCallback, useEffect, useMemo, useState } from 'react'
import { batchOutcomeWords } from '../lib/batchWords'
import type { ArReturnCaseView } from '../lib/jobs/arReturnCase'
import { keepReleaseFacts } from '../lib/jobs/lienReleaseRunIo'
import { PAYOFF_RETURNED_WORDS, payoffReturnedView, returnedMarkNow, type PayoffReturnedView } from '../lib/jobs/payoffReturned'
import { readReturnedCaseLiens } from '../lib/jobs/payoffReturnedIo'
import { formatErrorMessage } from '../utils/errorHandling'

/**
 * What the case pane draws of the liens on a returned check's jobs. `view` null with `ready`: none of them is liened.
 * `mark` is the press that tells the Lien desk (the returned check's mark): absent when nothing is left to mark or
 * nobody is signed in. `said` is what the last press did, drawn under it.
 */
export type ReturnedCaseLiens = {
  status: 'reading' | 'ready' | 'failed'
  view: PayoffReturnedView | null
  why: string | null
  mark?: (() => void) | null
  marking?: boolean
  said?: { text: string; tone: 'ok' | 'bad' } | null
}

/**
 * A check that came back: the bank sent it back, or the office marked it returned by hand. A check the bank could
 * not read, and one typed in and never deposited, did not come back: each is deposited again, and reads nothing here.
 */
const CAME_BACK_SOURCES: ReadonlyArray<ArReturnCaseView['source']> = ['bank', 'hand']

/**
 * The filed liens on the jobs of the case in the pane, each with where its release stands (punch list #435,
 * piece 6; the rule is `payoffReturned.ts`). Read again when the case changes or its jobs do, as after a take off,
 * and after a mark is kept. A Stripe case is not a check and reads nothing. Null while no such case is open or the
 * seat may not apply.
 *
 * `userId` is who is signed in, kept with a mark. The mark is one update a saved release (`keepReleaseFacts`), the
 * run going on past a row that fails.
 */
export function useReturnedCaseLiens(view: ArReturnCaseView | null, enabled: boolean, read: typeof readReturnedCaseLiens = readReturnedCaseLiens, userId?: string | null, keep: typeof keepReleaseFacts = keepReleaseFacts): ReturnedCaseLiens | null {
  const isCheck = view != null && CAME_BACK_SOURCES.includes(view.source)
  // The case's jobs as one string, so the read follows a take off and nothing else.
  const key = useMemo(() => {
    if (!view || !isCheck) return null
    const jobs = { on: (view.takeOff?.jobs ?? []).map((j) => j.jobId), rec: view.recorded?.jobId ?? null, off: view.billsItPaid.map((b) => b.jobId), last: view.promiseJob?.jobId ?? null }
    return `${view.id}|${JSON.stringify(jobs)}`
  }, [view, isCheck])
  const [state, setState] = useState<{ key: string; liens: ReturnedCaseLiens } | null>(null)
  /** Bumped after a mark is kept, so the liens are read again. */
  const [again, setAgain] = useState(0)
  const [marking, setMarking] = useState(false)
  const [said, setSaid] = useState<{ key: string; text: string; tone: 'ok' | 'bad' } | null>(null)
  useEffect(() => {
    if (!key || !view || !enabled) return
    let live = true
    // A bank or hand case's id is its deposit's.
    read({ takeOff: view.takeOff, recorded: view.recorded, billsItPaid: view.billsItPaid, promiseJob: view.promiseJob }, view.id)
      .then((input) => {
        if (live) setState({ key, liens: { status: 'ready', view: payoffReturnedView({ ...input, caseId: view.id, cameBackYmd: view.cameBackYmd }), why: null } })
      })
      .catch((e: unknown) => {
        if (live) setState({ key, liens: { status: 'failed', view: null, why: formatErrorMessage(e, '') || null } })
      })
    return () => {
      live = false
    }
    // `view` rides on `key`: the same case with the same jobs is not read twice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled, read, again])

  const liens = key && state?.key === key ? state.liens : null
  const toMark = liens?.view?.mark ?? null
  const mark = useCallback(() => {
    if (!key || !toMark || !userId || marking) return
    setMarking(true)
    void keep(toMark.rows, { moneyBack: returnedMarkNow(toMark.change, userId, new Date().toISOString()) })
      .then((outcomes) => {
        const done = outcomes.filter((o) => o.ok).length
        const failed = outcomes.length - done
        const words = batchOutcomeWords({ verb: 'take the mark', past: 'held', done, failed, noun: ['release', 'releases'] })
        const why = outcomes.find((o) => !o.ok)?.why
        setSaid({ key, text: failed ? `${words.line}${why ? ` ${why}` : ''}` : `${words.line} ${PAYOFF_RETURNED_WORDS.marked}`, tone: failed ? 'bad' : 'ok' })
        if (done > 0) setAgain((n) => n + 1)
      })
      .catch((e: unknown) => setSaid({ key, text: formatErrorMessage(e, PAYOFF_RETURNED_WORDS.markFailed), tone: 'bad' }))
      .finally(() => setMarking(false))
  }, [key, toMark, userId, marking, keep])

  if (!key || !enabled) return null
  if (!liens) return { status: 'reading', view: null, why: null }
  return { ...liens, mark: toMark && userId ? mark : null, marking, said: said?.key === key ? { text: said.text, tone: said.tone } : null }
}
