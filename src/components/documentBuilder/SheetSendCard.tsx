/**
 * The send of one job's sheet to that job's trades (punch list #404, step 5): the list's reads and presses, wired to
 * the `document-builder-send` function. A trade gets an email with the note and one press to the page it already
 * opens, and the sheet is then on that page beside its certificate. The list is `BuilderSendList`.
 */
import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import OfflineRetryPanel from '../OfflineRetryPanel'
import type { Landed } from '../../lib/documentBuilder/documentBuildersIo'
import type { SendParty } from '../../lib/documentBuilder/send'
import { readSheetParties, sendSheet, takeSendOff } from '../../lib/documentBuilder/sendIo'
import { SHEET_SEND_NOTE } from '../../lib/documentBuilder/sendWords'
import { makeTradePortalLink } from '../../lib/gc/tradePortalLinksIo'
import { recoveryFailureFromError, type OfflineRecoveryLastError } from '../../lib/offlineRecoveryState'
import { formatErrorMessage } from '../../utils/errorHandling'
import { BuilderSendList } from './BuilderSendList'

export type SheetSendIo = {
  readParties: typeof readSheetParties
  send: typeof sendSheet
  takeOff: typeof takeSendOff
  /** Turns a company's own page on again. Its own press: a send never does it. */
  turnPageOn: (companyId: string) => Promise<Landed<true>>
}

async function turnTradePageOn(companyId: string): Promise<Landed<true>> {
  try {
    await makeTradePortalLink(companyId, false)
    return { ok: true, value: true }
  } catch (e) {
    return { ok: false, error: formatErrorMessage(e, 'Their page was not turned on.') }
  }
}

export const SHEET_SEND_IO: SheetSendIo = { readParties: readSheetParties, send: sendSheet, takeOff: takeSendOff, turnPageOn: turnTradePageOn }

type Props = {
  builderKey: string
  projectId: string
  /** The job's sheet. Null before its row is made. */
  sheetId: string | null
  /** The sheet's published revision. 0 before the first publish. */
  revision: number
  /** Why the usual is unread, or an empty string once the agent's check is marked. */
  unread: string
  io?: SheetSendIo
}

const MUTED: CSSProperties = { margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }

export function SheetSendCard({ builderKey, projectId, sheetId, revision, unread, io = SHEET_SEND_IO }: Props) {
  const [parties, setParties] = useState<SendParty[] | null>(null)
  const [failure, setFailure] = useState<OfflineRecoveryLastError | null>(null)
  const [reading, setReading] = useState(true)
  const [tries, setTries] = useState(0)

  useEffect(() => {
    let cancelled = false
    setReading(true)
    void io
      .readParties(projectId, sheetId)
      .then((got) => {
        if (cancelled) return
        setParties(got)
        setFailure(null)
      })
      .catch((e: unknown) => {
        if (!cancelled) setFailure(recoveryFailureFromError(e, "This job's trades did not read."))
      })
      .finally(() => {
        if (!cancelled) setReading(false)
      })
    return () => {
      cancelled = true
    }
  }, [io, projectId, sheetId, revision, tries])

  /** Run a press, then read the rows again so each shows where it now stands. */
  const then = useCallback(async <T,>(act: Promise<Landed<T>>): Promise<Landed<T>> => {
    const res = await act
    if (res.ok) setTries((n) => n + 1)
    return res
  }, [])

  if (failure) return <OfflineRetryPanel failure={failure} onRetry={() => setTries((n) => n + 1)} surface="documents-builder-sends" idempotent busy={reading} />
  if (!parties) return <p style={MUTED}>Reading this job's trades…</p>

  return (
    <BuilderSendList
      title="Send the sheet to this job's trades"
      lead="A trade you send it to gets an email with the ask for a certificate. They also find the sheet on their own page."
      parties={parties}
      revision={revision}
      published={revision > 0 && sheetId != null}
      unpublishedWords="Publish this job's sheet first."
      unread={unread}
      noun="trade"
      defaultNote={SHEET_SEND_NOTE}
      emptyWords="No trade is on this job yet. A trade shows here once it is asked to quote on the GC projects page."
      onSend={(party, to, note, why, anyway) => (sheetId ? then(io.send({ builderKey, sheetId, companyId: party.id, contactEmail: to.email, note, why, anyway })) : Promise.resolve({ ok: false as const, error: "Publish this job's sheet first." }))}
      onTakeOff={(party) => (party.send ? then(io.takeOff(party.send.id)) : Promise.resolve({ ok: true as const, value: true }))}
      onTurnPageOn={(party) => then(io.turnPageOn(party.id))}
    />
  )
}
