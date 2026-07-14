import { useMemo, useState, type CSSProperties } from 'react'
import { useReportQuickfillSectionMetric } from '../../contexts/QuickfillSectionMetricsContext'
import { useToastContext } from '../../contexts/ToastContext'
import { useAuth } from '../../hooks/useAuth'
import { useChecklistAddModal } from '../../contexts/ChecklistAddModalContext'
import { useDispatchTaskModal } from '../../contexts/DispatchTaskModalContext'
import { useEstimatorTaskModal } from '../../contexts/EstimatorTaskModalContext'
import { isAssistantLike } from '../../lib/subcontractorLikeRole'

const NOTE_MAX_CHARS = 10_000

type MarkPalette = { bg: string; border: string }

type QuickfillPhysicalInboxSectionProps = {
  markButtonPalette: MarkPalette
  onConfirmMark: (trimmedNote: string) => void
}

const hintStyle: CSSProperties = {
  fontSize: '0.875rem',
  color: 'var(--text-slate-600)',
  margin: '0 0 0.75rem',
  lineHeight: 1.45,
}

const actionButtonBase: CSSProperties = {
  height: 'calc(1rem + 1.25em)',
  boxSizing: 'border-box',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 4,
  cursor: 'pointer',
  border: 'none',
  padding: '0.5rem 0.5rem',
  color: 'white',
}

export function QuickfillPhysicalInboxSection({ markButtonPalette, onConfirmMark }: QuickfillPhysicalInboxSectionProps) {
  const { role } = useAuth()
  const { showToast } = useToastContext()
  const checklistAddModal = useChecklistAddModal()
  const dispatchTaskModal = useDispatchTaskModal()
  const estimatorTaskModal = useEstimatorTaskModal()
  const [inboxNote, setInboxNote] = useState('')

  const showDispatchEstimator =
    role === 'dev' || role === 'master_technician' || isAssistantLike(role) || role === 'estimator'
  const showTask =
    role === 'dev' || role === 'master_technician' || isAssistantLike(role) || role === 'primary' || role === 'estimator'

  const itemsNotedCount = useMemo(() => {
    return inboxNote.split(/\r?\n/).filter((line) => line.trim().length > 0).length
  }, [inboxNote])

  useReportQuickfillSectionMetric('physical-inbox', itemsNotedCount, false)

  function handleMarkComplete() {
    const trimmed = inboxNote.trim()
    if (!trimmed) {
      showToast('List what is still in your physical inbox before marking complete.', 'warning')
      return
    }
    const capped = trimmed.length > NOTE_MAX_CHARS ? trimmed.slice(0, NOTE_MAX_CHARS) : trimmed
    onConfirmMark(capped)
    setInboxNote('')
  }

  const promptsId = 'quickfill-physical-inbox-prompts'
  const showActionButtons = showDispatchEstimator || showTask

  const promptsBlock = (
    <div
      id={promptsId}
      style={
        showActionButtons
          ? { flex: '1 1 200px', minWidth: '12rem', maxWidth: '32rem', margin: 0 }
          : { marginBottom: '0.75rem' }
      }
    >
      <p style={showActionButtons ? { ...hintStyle, marginBottom: 0 } : hintStyle}>
        {`Is my physical inbox clear? - For items that can't be quickly cleared, have you added a task? Use these buttons, same as the header.`}
      </p>
    </div>
  )

  return (
    <section
      style={{
        borderRadius: 8,
        padding: '1rem 1.25rem',
        background: 'var(--bg-page)',
      }}
    >
      {showActionButtons ? (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'flex-start',
            gap: '0.75rem',
            marginBottom: '0.75rem',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.5rem',
              alignItems: 'center',
              flexShrink: 0,
            }}
          >
            {showDispatchEstimator && (
              <button
                type="button"
                onClick={() => dispatchTaskModal?.openDispatchModal()}
                title="Task Dispatch"
                aria-label="Task Dispatch"
                style={{ ...actionButtonBase, background: '#0ea5e9' }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 640 640"
                  width="1.25em"
                  height="1.25em"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M280 128C266.7 128 256 138.7 256 152C256 165.3 266.7 176 280 176L296 176L296 209.3C188.8 220.7 104.2 307.7 96.6 416L543.5 416C535.8 307.7 451.2 220.7 344 209.3L344 176L360 176C373.3 176 384 165.3 384 152C384 138.7 373.3 128 360 128L280 128zM88 464C74.7 464 64 474.7 64 488C64 501.3 74.7 512 88 512L552 512C565.3 512 576 501.3 576 488C576 474.7 565.3 464 552 464L88 464z" />
                </svg>
              </button>
            )}
            {showDispatchEstimator && (
              <button
                type="button"
                onClick={() => estimatorTaskModal?.openEstimatorModal()}
                title="Estimator Inbox"
                aria-label="Estimator Inbox"
                style={{ ...actionButtonBase, background: '#7c3aed' }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 640 640"
                  width="1.25em"
                  height="1.25em"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M468 64C487.2 64 505.6 71.6 519.1 85.2L554.8 120.9C568.4 134.4 576 152.8 576 172C576 191.2 568.4 209.6 554.8 223.1L509.9 268L372 130.1L416.9 85.2C430.4 71.6 448.8 64 468 64zM122.9 379.1L338.1 164L476 301.9L260.9 517.1C250.2 527.8 236.8 535.6 222.2 539.7L94.4 575.1C86.1 577.4 77.1 575.1 71 568.9C64.9 562.7 62.5 553.8 64.8 545.5L100.4 417.8C104.5 403.2 112.2 389.9 123 379.1zM289.4 144.8L144.8 289.4L75.7 220.3C60.1 204.7 60.1 179.4 75.7 163.7L163.7 75.7C179.3 60.1 204.6 60.1 220.3 75.7L226.2 81.6L169.9 137.9C162.1 145.7 162.1 158.4 169.9 166.2C177.7 174 190.4 174 198.2 166.2L254.5 109.9L289.4 144.8zM495.2 350.6L530.1 385.5L473.8 441.8C466 449.6 466 462.3 473.8 470.1C481.6 477.9 494.3 477.9 502.1 470.1L558.4 413.8L564.3 419.7C579.9 435.3 579.9 460.6 564.3 476.3L476.3 564.3C460.7 579.9 435.4 579.9 419.7 564.3L350.6 495.2L495.2 350.6z" />
                </svg>
              </button>
            )}
            {showTask && (
              <button
                type="button"
                onClick={() => checklistAddModal?.openAddModal()}
                title="Task"
                aria-label="Task"
                style={{ ...actionButtonBase, background: '#3b82f6', fontWeight: 500 }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 640 640"
                  width="1.25em"
                  height="1.25em"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M530.8 134.1C545.1 144.5 548.3 164.5 537.9 178.8L281.9 530.8C276.4 538.4 267.9 543.1 258.5 543.9C249.1 544.7 240 541.2 233.4 534.6L105.4 406.6C92.9 394.1 92.9 373.8 105.4 361.3C117.9 348.8 138.2 348.8 150.7 361.3L252.2 462.8L486.2 141.1C496.6 126.8 516.6 123.6 530.9 134z" />
                </svg>
              </button>
            )}
          </div>
          {promptsBlock}
        </div>
      ) : (
        promptsBlock
      )}
      <div
        style={{
          margin: '0 0 0.35rem',
          fontSize: '0.875rem',
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.35rem',
        }}
      >
        <label
          htmlFor="quickfill-physical-inbox-textarea"
          style={{ fontWeight: 600, color: 'var(--text-700)', cursor: 'pointer', margin: 0 }}
        >
          Still in physical inbox
        </label>
      </div>
      <textarea
        id="quickfill-physical-inbox-textarea"
        value={inboxNote}
        onChange={(e) => setInboxNote(e.target.value)}
        aria-describedby={promptsId}
        rows={6}
        style={{
          width: '100%',
          maxWidth: '100%',
          boxSizing: 'border-box',
          padding: '0.65rem',
          borderRadius: 6,
          border: '1px solid var(--border-strong)',
          fontSize: '0.875rem',
          fontFamily: 'inherit',
          resize: 'vertical',
          minHeight: '6rem',
        }}
      />
      <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'center' }}>
        <button
          type="button"
          onClick={handleMarkComplete}
          style={{
            padding: '0.5rem 0.75rem',
            borderRadius: 6,
            background: markButtonPalette.bg,
            border: `1px solid ${markButtonPalette.border}`,
            cursor: 'pointer',
            fontSize: '0.875rem',
            fontWeight: 500,
          }}
        >
          Mark Physical inbox up to date!
        </button>
      </div>
    </section>
  )
}
