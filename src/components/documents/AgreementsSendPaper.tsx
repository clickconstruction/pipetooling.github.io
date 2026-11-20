import { Suspense, lazy, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useToastContext } from '../../contexts/ToastContext'
import { SEND_A_PAPER_LABEL, papersMatching, sendablePapers } from '../../lib/documents/agreementsSend'
import { readAgreementsSendBook, type AgreementsSendBook } from '../../lib/documents/agreementsSendIo'
import { quickSendNoContentWords, quickSendPickPlan, type QuickSendPlan } from '../../lib/contractsQuickSend'
import { readPersonSendFactsByName, type PersonPaperSendFacts } from '../../lib/contracts/personPaperSendIo'
import { emptyWords, emptyWordsWithPress } from '../../lib/emptyWords'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { formatErrorMessage } from '../../utils/errorHandling'
import { EmptyState } from '../EmptyState'
import { ContractQuickSendPicker } from '../people/ContractQuickSendPicker'

/**
 * Documents → Agreements, **Send a paper** (punch list #376, the second train): one press that picks a paper from the
 * Contract Book, then a person, and opens the Send for signature window on the pick. It is People → Contracts' quick
 * send on this page: the same person picker, the same plan (`quickSendPickPlan`), the same window and the same sender.
 * Nothing is written until **Send email** is pressed, so closing any step leaves nothing behind. Once the email goes,
 * `onSent` lets the list read again and the new line shows on it.
 *
 * `startOn` lets another door start at the person step for a paper it names: the Contract library's Send to…. And
 * `onOpenLibrary` is where the paper step sends someone who wants to write or change a paper.
 */

const ContractSendWindow = lazy(() => import('../contracts/ContractSendWindow').then((m) => ({ default: m.ContractSendWindow })))

const primary: CSSProperties = { padding: '0.5rem 0.9rem', borderRadius: 6, border: '1px solid #2563eb', background: '#2563eb', color: 'white', fontFamily: 'inherit', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }
const primaryBusy: CSSProperties = { ...primary, background: DEAD_PRESS_FILL, border: '1px solid var(--border-strong)', color: DEAD_PRESS_TEXT, cursor: 'wait' }
const paperRow: CSSProperties = { display: 'block', width: '100%', padding: '0.5rem 0.6rem', border: 'none', borderBottom: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.875rem', textAlign: 'left', color: 'var(--text-strong)' }
const paperFrom: CSSProperties = { display: 'block', color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.1rem' }

type Step =
  | { at: 'paper' }
  | { at: 'person'; documentName: string }
  | { at: 'send'; documentName: string; docId: string | null; plan: QuickSendPlan; again: boolean; facts: PersonPaperSendFacts }

export function AgreementsSendPaper({
  onSent,
  startOn = null,
  onOpenLibrary,
}: {
  onSent: () => void
  /** A paper another door picked. A new object starts the person step on it. */
  startOn?: { documentName: string } | null
  /** Opens the Contract library in place. */
  onOpenLibrary: () => void
}) {
  const { user } = useAuth()
  const { showToast } = useToastContext()
  const [data, setData] = useState<AgreementsSendBook | null>(null)
  const [step, setStep] = useState<Step | null>(null)
  const [busy, setBusy] = useState<null | 'open' | 'pick'>(null)
  const [typed, setTyped] = useState('')

  const papers = useMemo(() => sendablePapers(data?.book ?? []), [data])
  const shown = useMemo(() => papersMatching(papers, typed), [papers, typed])

  // The Book, the papers people hold and the roster are read on the press, so the pick is made on what is true now.
  const open = async () => {
    if (busy) return
    setBusy('open')
    try {
      setData(await readAgreementsSendBook())
      setTyped('')
      setStep({ at: 'paper' })
    } catch (e) {
      showToast(formatErrorMessage(e, 'The Contract Book did not read.'), 'error')
    } finally {
      setBusy(null)
    }
  }

  // A person was picked for the paper: decide the plan, read their address, and open the Send window. Nothing is written.
  const pickPerson = async (documentName: string, personName: string) => {
    if (busy || !data) return
    const { existing, plan } = quickSendPickPlan({ documentName, personName, templateDocuments: data.book, personDocuments: data.personDocuments })
    if (plan.kind === 'no-content') {
      showToast(quickSendNoContentWords(documentName), 'error')
      return
    }
    setBusy('pick')
    try {
      const facts = await readPersonSendFactsByName(personName, documentName, user?.id)
      setStep({ at: 'send', documentName, docId: plan.kind === 'insert' ? null : plan.docId, plan, again: existing?.status === 'sent', facts })
    } catch (e) {
      showToast(formatErrorMessage(e, 'The person’s address did not read.'), 'error')
    } finally {
      setBusy(null)
    }
  }

  const close = () => setStep(null)

  // Another door named the paper: read what the pick needs, then ask for the person.
  useEffect(() => {
    if (!startOn) return
    let live = true
    setBusy('open')
    readAgreementsSendBook().then(
      (read) => {
        if (!live) return
        setData(read)
        setStep({ at: 'person', documentName: startOn.documentName })
        setBusy(null)
      },
      (e: unknown) => {
        if (!live) return
        showToast(formatErrorMessage(e, 'The Contract Book did not read.'), 'error')
        setBusy(null)
      },
    )
    return () => {
      live = false
    }
  }, [startOn, showToast])

  const toLibrary = () => {
    setStep(null)
    onOpenLibrary()
  }

  return (
    <>
      <button type="button" style={busy === 'open' ? primaryBusy : primary} disabled={busy != null} onClick={() => void open()}>
        {busy === 'open' ? 'Opening…' : SEND_A_PAPER_LABEL}
      </button>
      {step?.at === 'paper' ? (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 714, paddingTop: 'var(--app-top-chrome, 0px)' }} onClick={close}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label={SEND_A_PAPER_LABEL}
            onClick={(e) => e.stopPropagation()}
            style={{ background: 'var(--surface)', borderRadius: 8, padding: '1rem 1.1rem', width: 'min(92vw, 420px)', maxHeight: 'min(80vh, 100%)', overflow: 'auto', boxSizing: 'border-box', boxShadow: '0 10px 30px rgba(0,0,0,0.18)' }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', lineHeight: 1.35 }}>{SEND_A_PAPER_LABEL}</h3>
              <button type="button" onClick={close} aria-label="Close" style={{ padding: '0.1rem 0.3rem', border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.15rem', lineHeight: 1, color: 'var(--text-muted)', flexShrink: 0 }}>
                ×
              </button>
            </div>
            <p style={{ margin: '0.25rem 0 0.6rem', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>Pick a paper from the Contract Book. You pick the person next.</p>
            {papers.length === 0 ? (
              <EmptyState compact {...emptyWordsWithPress(emptyWords({ kind: 'data', noun: 'papers in the Contract Book', page: { label: 'Contract library', tail: 'is where a paper is written.' } }), { onPress: toLibrary })} />
            ) : (
              <>
                <input
                  type="search"
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  placeholder="Find a paper"
                  aria-label="Find a paper"
                  autoFocus
                  style={{ width: '100%', boxSizing: 'border-box', padding: '0.45rem 0.6rem', border: '1px solid var(--border-strong)', borderRadius: 6, fontSize: '0.875rem', background: 'var(--surface)', color: 'var(--text-strong)', marginBottom: '0.2rem' }}
                />
                {shown.length === 0 ? (
                  <EmptyState compact {...emptyWordsWithPress(emptyWords({ kind: 'filter', noun: 'papers', query: typed }), { onPress: () => setTyped('') })} />
                ) : (
                  shown.map((p) =>
                    p.hasWords ? (
                      <button key={p.bookDocumentId} type="button" style={paperRow} onClick={() => setStep({ at: 'person', documentName: p.paperName })}>
                        {p.paperName}
                        <span style={paperFrom}>{p.from}</span>
                      </button>
                    ) : (
                      // A paper with nothing to sign cannot go out: it names why, and is not a press.
                      <div key={p.bookDocumentId} style={{ ...paperRow, cursor: 'default', color: 'var(--text-muted)' }} data-testid="send-paper-no-words">
                        {p.paperName}
                        <span style={paperFrom}>{p.from}</span>
                      </div>
                    ),
                  )
                )}
                <p style={{ margin: '0.6rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  A job’s contract is sent from its job. A paper is written and changed in the{' '}
                  <button type="button" onClick={toLibrary} style={{ padding: 0, border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit', color: 'var(--text-link)', fontWeight: 600 }}>
                    Contract library
                  </button>
                  .
                </p>
              </>
            )}
          </div>
        </div>
      ) : null}
      {step?.at === 'person' && data ? (
        <ContractQuickSendPicker
          documentName={step.documentName}
          rosterNames={data.rosterNames}
          personDocuments={data.personDocuments}
          busy={busy === 'pick'}
          onPick={(personName) => void pickPerson(step.documentName, personName)}
          onClose={close}
        />
      ) : null}
      {step?.at === 'send' ? (
        <Suspense fallback={null}>
          <ContractSendWindow
            again={step.again}
            target={step.facts.target}
            docId={step.docId}
            quickSendPlan={step.plan}
            initialEmail={step.facts.initialEmail}
            initialSignerName={step.facts.signerName}
            initialSignerTitle={step.facts.signerTitle}
            sender={step.facts.sender}
            personId={step.facts.personId}
            onClose={close}
            onSent={() => {
              setStep(null)
              onSent()
            }}
          />
        </Suspense>
      ) : null}
    </>
  )
}

export default AgreementsSendPaper
