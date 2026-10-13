import { useState } from 'react'
import { useToastContext } from '../../../contexts/ToastContext'
import { useOptionalAuth } from '../../../hooks/useAuth'
import { firstName, type Contact } from '../../../lib/contacts/kernel'
import { fileUrl } from '../../../lib/files/fileRoute'
import { canUseGcBoardWrites } from '../../../lib/gc/access'
import { DOC_KEYS } from '../../../lib/gc/companyFile'
import { paperOffer, type LineFile } from '../../../lib/messages/lineFiles'
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
 */
export function PaperOffers({ message, contact }: { message: ThreadMessage; contact: Contact }) {
  // Outside the signed-in app (a smoke, a preview), nobody may file.
  const role = useOptionalAuth()?.role ?? null
  const opener = useCompanyOpener()
  const { closeThread } = useThreadWindow()
  const reread = useMessagesReread()
  const { showToast } = useToastContext()
  const [busy, setBusy] = useState<string | null>(null)
  const canFile = canUseGcBoardWrites(role)
  const offers = (message.files ?? []).flatMap((file) => {
    const offer = paperOffer(file, contact, canFile)
    return offer ? [{ file, offer }] : []
  })
  if (offers.length === 0) return null
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
  const notIt = (file: LineFile) => {
    setBusy(file.id)
    answerPaper(file.id, 'not_it')
      .then(reread, (e: unknown) => showToast(formatErrorMessage(e, 'The offer was not taken away.'), 'error'))
      .finally(() => setBusy(null))
  }

  return (
    <>
      {offers.map(({ file, offer }) => (
        <div
          key={file.id}
          data-paper-offer={file.id}
          style={{ maxWidth: 'min(640px, 92%)', padding: '0.5rem 0.6rem', borderRadius: 8, background: 'var(--bg-orange-tint)', border: '1px solid var(--border-amber-soft)', fontSize: '0.85rem', display: 'grid', gap: '0.4rem' }}
        >
          <span>{offer.words}</span>
          <span style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            {opener && companyId && (
              <Btn kind={offer.paper === 'coi' && canFile ? 'primary' : 'plain'} onClick={() => goTo(file, offer.paper)} disabled={busy === file.id}>
                {offer.press}
              </Btn>
            )}
            <Btn onClick={() => notIt(file)} disabled={busy === file.id} title="Takes the offer away for everyone. The file stays on the line.">
              It is not
            </Btn>
          </span>
        </div>
      ))}
    </>
  )
}
