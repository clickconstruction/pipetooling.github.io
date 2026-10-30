import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToastContext } from '../../../contexts/ToastContext'
import { useOptionalAuth } from '../../../hooks/useAuth'
import { useBillReadSwitch } from '../../../hooks/useBillReadSwitch'
import { firstName, type Contact } from '../../../lib/contacts/kernel'
import { fileUrl } from '../../../lib/files/fileRoute'
import { canUseGcBoardWrites } from '../../../lib/gc/access'
import { DOC_KEYS } from '../../../lib/gc/companyFile'
import { supabaseBillsIo } from '../../../lib/materials/bills/billsToRecordIo'
import { billOffer, paperOffer, type LineFile } from '../../../lib/messages/lineFiles'
import { answerPaper } from '../../../lib/messages/messagesIo'
import type { ThreadMessage } from '../../../lib/messages/thread'
import { formatErrorMessage } from '../../../utils/errorHandling'
import { useCompanyOpener } from '../gcCompanyOpener'
import { Btn } from '../gcUi'
import { useMessagesReread } from './useMessagesReread'
import { useThreadWindow } from './useThreadWindow'

/**
 * Messages, cut 6's screens: the offer under a line for each file that reads as a trade partner's paper (the mock-up's
 * screen 3). It is never filed on its own. The press closes the thread and opens the company window at that paper, with
 * the file's lasting link in the certificate's form, and the office saves it there (the page marks the offer filed).
 * A W-9 has no save from here yet, so its press only goes to the paper. It is not takes the offer away for everyone.
 *
 * Since punch list #179 (v2.6095) a supply house's PDF or picture gets the same offer as a bill to record: *Record this
 * bill* closes the thread and opens the Add invoice window on the house with the file picked, where the PDF fills the
 * form and a person saves it; *Not a bill* takes the offer away for everyone, the file staying on the line. The doors
 * show only to the office while the fill's switch is on.
 */
export function PaperOffers({ message, contact }: { message: ThreadMessage; contact: Contact }) {
  // Outside the signed-in app (a smoke, a preview), nobody may file.
  const role = useOptionalAuth()?.role ?? null
  const opener = useCompanyOpener()
  const { closeThread } = useThreadWindow()
  const reread = useMessagesReread()
  const { showToast } = useToastContext()
  const navigate = useNavigate()
  const { on: billsOn } = useBillReadSwitch(role)
  const [busy, setBusy] = useState<string | null>(null)
  const canFile = canUseGcBoardWrites(role)
  const offers = (message.files ?? []).flatMap((file) => {
    const offer = paperOffer(file, contact, canFile)
    return offer ? [{ file, offer }] : []
  })
  const bills = billsOn
    ? (message.files ?? []).flatMap((file) => {
        const offer = billOffer(file, contact)
        return offer ? [{ file, offer }] : []
      })
    : []
  if (offers.length === 0 && bills.length === 0) return null
  const companyId = contact.gcCompanyId ?? null

  const goTo = (file: LineFile, paper: 'coi' | 'w9') => {
    if (!opener || !companyId) return
    const who = firstName(contact)
    closeThread()
    opener.openPartner(companyId, {
      tab: 'documents',
      doc: paper === 'coi' ? DOC_KEYS.insurance : DOC_KEYS.w9,
      file: { attachmentId: file.id, name: file.name, link: fileUrl('messages', file.id), from: who ? `${who}’s email` : 'their email' },
    })
  }
  const notIt = (file: LineFile, failed: string) => {
    setBusy(file.id)
    answerPaper(file.id, 'not_it')
      .then(reread, (e: unknown) => showToast(formatErrorMessage(e, failed), 'error'))
      .finally(() => setBusy(null))
  }
  const recordBill = (file: LineFile) => {
    setBusy(file.id)
    const houseId = contact.record?.table === 'supply_houses' ? Promise.resolve(contact.record.id) : supabaseBillsIo().houseOfContact(contact.id)
    houseId
      .then((id) => {
        if (!id) {
          showToast('This thread is not on a supply house. Open the house on Materials and record the bill there.', 'error')
          return
        }
        closeThread()
        navigate(`/materials?tab=supply-houses&house=${encodeURIComponent(id)}&bill=${encodeURIComponent(file.id)}`)
      })
      .catch((e: unknown) => showToast(formatErrorMessage(e, 'The house could not be found.'), 'error'))
      .finally(() => setBusy(null))
  }

  const box = (key: string, children: ReactNode) => (
    <div
      key={key}
      data-paper-offer={key}
      style={{ maxWidth: 'min(640px, 92%)', padding: '0.5rem 0.6rem', borderRadius: 8, background: 'var(--bg-orange-tint)', border: '1px solid var(--border-amber-soft)', fontSize: '0.85rem', display: 'grid', gap: '0.4rem' }}
    >
      {children}
    </div>
  )

  return (
    <>
      {offers.map(({ file, offer }) =>
        box(
          file.id,
          <>
            <span>{offer.words}</span>
            <span style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {opener && companyId && (
                <Btn kind={offer.paper === 'coi' && canFile ? 'primary' : 'plain'} onClick={() => goTo(file, offer.paper)} disabled={busy === file.id}>
                  {offer.press}
                </Btn>
              )}
              <Btn onClick={() => notIt(file, 'The offer was not taken away.')} disabled={busy === file.id} title="Takes the offer away for everyone. The file stays on the line.">
                It is not
              </Btn>
            </span>
          </>,
        ),
      )}
      {bills.map(({ file, offer }) =>
        box(
          file.id,
          <>
            <span>{offer.line}</span>
            <span style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              <Btn kind="primary" onClick={() => recordBill(file)} disabled={busy === file.id}>
                {offer.record}
              </Btn>
              <Btn onClick={() => notIt(file, 'The offer was not taken away.')} disabled={busy === file.id} title={offer.notABillTitle}>
                {offer.notABill}
              </Btn>
            </span>
          </>,
        ),
      )}
    </>
  )
}
