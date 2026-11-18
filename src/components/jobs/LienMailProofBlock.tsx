import { useRef, type CSSProperties } from 'react'
import { LIEN_MAIL_PROOF_WORDS, type LienMailProof, type LienMailProofCopy } from '../../lib/jobs/lienMailProof'
import { LIEN_MAILED_COPY_ACCEPT } from '../../lib/jobs/lienMailedCopies'
import { LienReceiptPhotoPress } from './LienReceiptPhotoPress'

/**
 * What went out, on a recorded lien paper (`lienMailProof.ts`): the files that went in the envelope, each a link,
 * then each envelope with its number and its receipt, a chip that counts the proof on file, and a **Next:** line
 * naming the one thing still missing.
 *
 * One block for the desk's Sent row, the stop's window and the Lien window's Filings list, so the three say the same
 * thing. With `receipts` each posted copy carries the receipt press (**Add the receipt**, then **Open**, **Replace**,
 * **Take off**). With `files` the block offers **Add what was mailed** or **Add another**. With neither it only reads.
 *
 * On a computer the labels sit in a column beside their lines. On a phone each part is a card of its own and every
 * press is a thumb tall.
 */
export type LienMailProofReceipts = {
  jobId: string
  jobNumber: string
  /** The day on the paper, for a receipt's file name. */
  day: string
  /** A receipt added (`url`) or taken off (`''`). The write's promise goes back to the press, which waits for it (v2.7743). */
  onSet: (recipient: LienMailProofCopy, url: string) => void | Promise<void>
}

export type LienMailProofFiles = {
  onAdd: (file: File) => void
  adding: boolean
}

const lab: CSSProperties = { fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }

export default function LienMailProofBlock({ proof, isMobile, receipts, files, bare }: { proof: LienMailProof; isMobile?: boolean; receipts?: LienMailProofReceipts; files?: LienMailProofFiles; /** Drawn inside a card that already has its own rule above. */ bare?: boolean }) {
  const input = useRef<HTMLInputElement>(null)
  const part: CSSProperties = isMobile
    ? { display: 'flex', flexDirection: 'column', gap: '0.3rem', padding: '0.5rem 0.6rem', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-subtle)', minWidth: 0 }
    : { display: 'grid', gridTemplateColumns: '9.5rem minmax(0, 1fr)', gap: '0.25rem 0.75rem', alignItems: 'start', minWidth: 0 }
  const label: CSSProperties = isMobile ? lab : { fontSize: '0.75rem', color: 'var(--text-muted)' }
  const press: CSSProperties = isMobile
    ? { minHeight: 44, width: '100%', padding: '0 0.9rem', fontSize: '0.875rem', fontWeight: 600, background: 'var(--surface)', color: 'inherit', border: '1px solid var(--border-strong)', borderRadius: 8, cursor: 'pointer' }
    : { padding: '0.3rem 0.7rem', fontSize: '0.78rem', fontWeight: 600, background: 'var(--surface)', color: 'inherit', border: '1px solid var(--border-strong)', borderRadius: 6, cursor: 'pointer' }
  const fileLink: CSSProperties = { color: 'var(--text-link)', fontWeight: 600, overflowWrap: 'anywhere', ...(isMobile ? { display: 'flex', alignItems: 'center', minHeight: 44 } : {}) }
  const paper = proof.paper === 'affidavit' ? 'affidavit' : 'notice'

  return (
    <div data-lien-mail-proof={proof.paper} style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '0.55rem' : '0.45rem', fontSize: isMobile ? '0.875rem' : '0.8125rem', minWidth: 0, ...(bare ? {} : { borderTop: '1px solid var(--border)', paddingTop: '0.6rem' }) }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem 0.6rem', alignItems: 'center' }}>
        <span style={lab}>{LIEN_MAIL_PROOF_WORDS.head}</span>
        <span data-lien-mail-proof-chip={proof.complete ? 'complete' : 'owed'} style={{ fontSize: '0.72rem', fontWeight: 700, padding: '0.1rem 0.5rem', borderRadius: 999, whiteSpace: 'nowrap', background: proof.complete ? 'var(--bg-green-tint)' : 'var(--bg-amber-tint)', color: proof.complete ? 'var(--text-green-800)' : 'var(--text-amber-800)' }}>
          {proof.chip}
        </span>
      </div>

      <div style={part} data-lien-mail-proof-files>
        <span style={label}>{proof.filesLabel}</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 0 : '0.2rem', minWidth: 0 }}>
          {proof.files.map((f) => (
            <a key={f.key} href={f.url} target="_blank" rel="noreferrer" style={fileLink}>
              {f.name} ›
            </a>
          ))}
          {proof.files.length === 0 ? <strong style={{ color: 'var(--text-amber-800)' }}>{proof.paper === 'affidavit' ? LIEN_MAIL_PROOF_WORDS.noScan : LIEN_MAIL_PROOF_WORDS.noFile}</strong> : null}
          {files ? (
            <span style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: isMobile ? '0.2rem' : '0.15rem' }}>
              <input
                ref={input}
                type="file"
                accept={LIEN_MAILED_COPY_ACCEPT}
                hidden
                aria-label={proof.files.length > 0 ? LIEN_MAIL_PROOF_WORDS.another : LIEN_MAIL_PROOF_WORDS.addFile}
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  e.target.value = ''
                  if (file) files.onAdd(file)
                }}
              />
              <button type="button" disabled={files.adding} onClick={() => input.current?.click()} style={{ ...press, ...(files.adding ? { cursor: 'wait' } : {}) }} data-lien-mail-proof-add>
                {files.adding ? LIEN_MAIL_PROOF_WORDS.adding : proof.files.length > 0 ? LIEN_MAIL_PROOF_WORDS.another : LIEN_MAIL_PROOF_WORDS.addFile}
              </button>
            </span>
          ) : null}
        </div>
      </div>

      {proof.envelopes.map((e) => (
        <div key={e.recipient} style={part} data-lien-mail-proof-envelope={e.recipient}>
          <span style={label}>{e.who}</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem 0.6rem', alignItems: 'center', minWidth: 0 }}>
            <span style={isMobile ? { flexBasis: '100%' } : undefined}>{e.line}</span>
            {!e.wantsReceipt ? null : receipts ? (
              <>
                {e.receiptUrl ? null : <strong style={{ color: 'var(--text-amber-800)' }}>{LIEN_MAIL_PROOF_WORDS.noReceipt}</strong>}
                <LienReceiptPhotoPress jobId={receipts.jobId} jobNumber={receipts.jobNumber} of={e.recipient} paper={paper} day={receipts.day} url={e.receiptUrl} compact={!isMobile} onSaved={(url) => receipts.onSet(e.recipient, url)} onTakeOff={() => receipts.onSet(e.recipient, '')} />
              </>
            ) : e.receiptUrl ? (
              <a href={e.receiptUrl} target="_blank" rel="noreferrer" aria-label={`${e.who}: open the receipt`} style={fileLink}>
                {LIEN_MAIL_PROOF_WORDS.receipt} ›
              </a>
            ) : (
              <strong style={{ color: 'var(--text-amber-800)' }}>{LIEN_MAIL_PROOF_WORDS.noReceipt}</strong>
            )}
          </div>
        </div>
      ))}

      {proof.next ? (
        <div data-lien-mail-proof-next style={{ fontSize: isMobile ? '0.8125rem' : '0.78rem', background: 'var(--bg-blue-tint)', color: 'var(--text-blue-800)', borderRadius: 6, padding: '0.35rem 0.6rem' }}>
          <strong>{LIEN_MAIL_PROOF_WORDS.next}</strong> {proof.next}
        </div>
      ) : null}
    </div>
  )
}
