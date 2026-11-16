import { useState, type CSSProperties } from 'react'
import { useToastContext } from '../../contexts/ToastContext'
import { formatErrorMessage } from '../../utils/errorHandling'
import { LIEN_PUBLIC_QUESTION, lienPublicAnsweredWords, type LienPublicAnswer } from '../../lib/jobs/lienPublicProperty'
import { setLienPublicAnswer } from '../../lib/jobs/lienPublicPropertyIo'
import LienPublicPropertyWindow from './LienPublicPropertyWindow'
import LienPublicPutBackWindow from './LienPublicPutBackWindow'

/**
 * The property record asks once (v2.7443, Taunya's ask of 2026-11-16, the second drawing, part 1): when the owner's
 * names read as a public body and nobody has answered, the record asks *Is this public property?*. *Yes, public
 * property…* opens the window that takes the property off the lien path; *No, it is private* stores the answer, and
 * the holds the name guess raised open. Only the lien office answers; anyone else reads the question without presses.
 */
type QuestionProps = {
  addressId: string
  /** The lien office (dev, master, assistant, controller): the function refuses anyone else. */
  canAnswer: boolean
  onAnswered: (answer: LienPublicAnswer | null) => void
  /** Above the window this sits in. */
  zIndex?: number
}

const box: CSSProperties = { display: 'grid', gap: '0.45rem', padding: '0.6rem 0.75rem', border: '1px solid var(--border-amber)', borderRadius: 8, background: 'var(--bg-amber-tint)', fontSize: '0.8125rem', lineHeight: 1.45 }
const plain: CSSProperties = { padding: '0.35rem 0.8rem', fontSize: '0.8125rem', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', fontWeight: 600, cursor: 'pointer' }
const blue: CSSProperties = { ...plain, border: '1px solid transparent', background: '#2563eb', color: '#ffffff' }
const link: CSSProperties = { background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--text-link)', fontWeight: 600, fontSize: '0.78rem' }

export default function LienPublicQuestion({ addressId, canAnswer, onAnswered, zIndex }: QuestionProps) {
  const { showToast } = useToastContext()
  const [windowOpen, setWindowOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const sayPrivate = async () => {
    if (busy) return
    setBusy(true)
    try {
      await setLienPublicAnswer({ addressId, answer: 'private' })
      showToast('Saved: not public property. Its lien papers can go out.', 'success')
      onAnswered('private')
    } catch (e) {
      showToast(`The answer was not saved: ${formatErrorMessage(e, 'the write failed')}`, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div data-lien-public-question style={box}>
      <div>
        <strong style={{ color: 'var(--text-amber-800)' }}>{LIEN_PUBLIC_QUESTION.lead}</strong> {LIEN_PUBLIC_QUESTION.ask}
      </div>
      <div data-lien-public-holds style={{ fontSize: '0.75rem', color: 'var(--text-amber-800)' }}>
        {canAnswer ? LIEN_PUBLIC_QUESTION.holds : `The office answers this. ${LIEN_PUBLIC_QUESTION.holds}`}
      </div>
      {canAnswer ? (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <button type="button" data-lien-public-yes style={blue} disabled={busy} onClick={() => setWindowOpen(true)}>
            {LIEN_PUBLIC_QUESTION.yes}
          </button>
          <button type="button" data-lien-public-no style={plain} disabled={busy} onClick={() => void sayPrivate()}>
            {busy ? 'Saving…' : LIEN_PUBLIC_QUESTION.no}
          </button>
        </div>
      ) : null}
      {windowOpen ? (
        <LienPublicPropertyWindow
          addressId={addressId}
          zIndex={zIndex}
          onClose={(answered) => {
            setWindowOpen(false)
            if (answered) onAnswered('public')
          }}
        />
      ) : null}
    </div>
  )
}

/**
 * The record's line once the question is answered, with the door that changes it: *Ask again* clears a private
 * answer (the name guess holds the papers again), *Put it back on the lien path…* takes a public answer back with a
 * reason.
 */
export function LienPublicAnswerLine({ addressId, answer, answeredAt, canAnswer, onAnswered, zIndex }: QuestionProps & { answer: LienPublicAnswer; answeredAt: string | null }) {
  const { showToast } = useToastContext()
  const [backOpen, setBackOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const askAgain = async () => {
    if (busy) return
    setBusy(true)
    try {
      await setLienPublicAnswer({ addressId, answer: 'unanswered' })
      showToast('The answer is cleared. The property asks again.', 'success')
      onAnswered(null)
    } catch (e) {
      showToast(`The answer was not cleared: ${formatErrorMessage(e, 'the write failed')}`, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div data-lien-public-answered={answer} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'baseline', fontSize: '0.78rem', color: answer === 'public' ? 'var(--text-amber-800)' : 'var(--text-muted)' }}>
      <span>{lienPublicAnsweredWords(answer, answeredAt)}</span>
      {canAnswer ? (
        answer === 'public' ? (
          <button type="button" style={link} onClick={() => setBackOpen(true)}>
            Put it back on the lien path…
          </button>
        ) : (
          <button type="button" style={link} disabled={busy} onClick={() => void askAgain()}>
            {busy ? 'Clearing…' : 'Ask again'}
          </button>
        )
      ) : null}
      {backOpen ? (
        <LienPublicPutBackWindow
          addressId={addressId}
          zIndex={zIndex}
          onClose={(changed) => {
            setBackOpen(false)
            if (changed) onAnswered(null)
          }}
        />
      ) : null}
    </div>
  )
}
