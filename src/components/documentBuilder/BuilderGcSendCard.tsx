/**
 * The send of a builder to GCs (punch list #404, step 9): step 5's list, pointed at the customers who are the GC on a
 * job with us, with the job a send is about. A GC gets an email with the note and one press to the page they already
 * open, and the builder is then on that page, under that job. The list is `BuilderSendList`.
 *
 * The one press reaches every GC whose page is on, so it asks first, by its count. That question is not in the drawing:
 * the list of GCs is the company's whole book, and one press there is many emails.
 */
import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import OfflineRetryPanel from '../OfflineRetryPanel'
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext'
import { countedLabel } from '../../lib/batchWords'
import type { Landed } from '../../lib/documentBuilder/documentBuildersIo'
import type { SendParty } from '../../lib/documentBuilder/send'
import { readBuilderParties, sendBuilder, takeSendOff } from '../../lib/documentBuilder/sendIo'
import { BUILDER_SEND_NOTE } from '../../lib/documentBuilder/sendWords'
import { recoveryFailureFromError, type OfflineRecoveryLastError } from '../../lib/offlineRecoveryState'
import { mintCustomerPortalLink } from '../../lib/portal/mintCustomerPortalLink'
import { formatErrorMessage } from '../../utils/errorHandling'
import { BuilderSendList } from './BuilderSendList'

export type BuilderGcSendIo = {
  readParties: typeof readBuilderParties
  send: typeof sendBuilder
  takeOff: typeof takeSendOff
  /** Turns a customer's own page on again. Its own press: a send never does it. */
  turnPageOn: (customerId: string) => Promise<Landed<true>>
}

async function turnCustomerPageOn(customerId: string): Promise<Landed<true>> {
  try {
    await mintCustomerPortalLink(customerId, 'all', false)
    return { ok: true, value: true }
  } catch (e) {
    return { ok: false, error: formatErrorMessage(e, 'Their page was not turned on.') }
  }
}

export const BUILDER_GC_SEND_IO: BuilderGcSendIo = { readParties: readBuilderParties, send: sendBuilder, takeOff: takeSendOff, turnPageOn: turnCustomerPageOn }

type Props = {
  builderKey: string
  /** The builder's published revision. 0 before the first publish. */
  revision: number
  /** Why the revision is unread (`builderUnreadWords`), or an empty string once someone marked it. */
  unread: string
  io?: BuilderGcSendIo
}

const MUTED: CSSProperties = { margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }

export function BuilderGcSendCard({ builderKey, revision, unread, io = BUILDER_GC_SEND_IO }: Props) {
  const confirmDialog = useConfirmDialog()
  const [parties, setParties] = useState<SendParty[] | null>(null)
  const [failure, setFailure] = useState<OfflineRecoveryLastError | null>(null)
  const [reading, setReading] = useState(true)
  const [tries, setTries] = useState(0)

  useEffect(() => {
    let cancelled = false
    setReading(true)
    void io
      .readParties(builderKey)
      .then((got) => {
        if (cancelled) return
        setParties(got)
        setFailure(null)
      })
      .catch((e: unknown) => {
        if (!cancelled) setFailure(recoveryFailureFromError(e, 'The GCs did not read.'))
      })
      .finally(() => {
        if (!cancelled) setReading(false)
      })
    return () => {
      cancelled = true
    }
  }, [io, builderKey, revision, tries])

  /** Run a press, then read the rows again so each shows where it now stands. */
  const then = useCallback(async <T,>(act: Promise<Landed<T>>): Promise<Landed<T>> => {
    const res = await act
    if (res.ok) setTries((n) => n + 1)
    return res
  }, [])

  if (failure) return <OfflineRetryPanel failure={failure} onRetry={() => setTries((n) => n + 1)} surface="documents-builder-gc-sends" idempotent busy={reading} />
  if (!parties) return <p style={MUTED}>Reading the GCs…</p>

  return (
    <BuilderSendList
      title="Send it to a GC"
      lead="A GC you send it to gets an email. They also find the builder on the page they already open."
      parties={parties}
      revision={revision}
      published={revision > 0}
      unpublishedWords="Publish the builder first."
      unread={unread}
      noun={['GC', 'GCs']}
      defaultNote={BUILDER_SEND_NOTE}
      showAbout
      findWords="Find a GC"
      emptyWords="No customer is the GC on a job yet. A GC shows here once a job names them as its GC."
      beforeBatch={(ready) => {
        const label = countedLabel('Send to', ready.length, ['GC', 'GCs'])
        return confirmDialog({ message: `${label}? Each gets an email now, about all their jobs with you.`, confirmLabel: label })
      }}
      onSend={(party, to, note, why, anyway, about) => then(io.send({ builderKey, customerId: party.id, aboutJobId: about, contactEmail: to.email, note, why, anyway }))}
      onTakeOff={(party) => (party.send ? then(io.takeOff(party.send.id)) : Promise.resolve({ ok: true as const, value: true }))}
      onTurnPageOn={(party) => then(io.turnPageOn(party.id))}
    />
  )
}
