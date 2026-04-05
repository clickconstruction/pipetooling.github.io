import { formatAcceptSignatureDate } from '../../lib/formatAcceptSignatureDate'

export const ESTIMATE_ACCEPT_SIGNATURE_FONT = '"Great Vibes", cursive'

const DEFAULT_PLACEHOLDER = 'Your name'

export type EstimateAcceptTypedSignatureLineProps = {
  printedName: string
  placeholderName?: string
  consentAtIso?: string | null | undefined
  /** Used when consentAtIso is missing or invalid (e.g. modal Type live preview). */
  previewDate?: Date
  ariaHidden?: boolean
  /** When set, drives name color instead of !printedName.trim() (e.g. readOnly modal placeholder). */
  nameMutedOverride?: boolean
}

function resolvedDateLine(
  consentAtIso: string | null | undefined,
  previewDate: Date | undefined,
): string {
  if (consentAtIso != null && consentAtIso !== '') {
    const d = new Date(consentAtIso)
    if (!Number.isNaN(d.getTime())) return formatAcceptSignatureDate(d)
  }
  if (previewDate != null && !Number.isNaN(previewDate.getTime())) {
    return formatAcceptSignatureDate(previewDate)
  }
  return '—'
}

export function EstimateAcceptTypedSignatureLine({
  printedName,
  placeholderName = DEFAULT_PLACEHOLDER,
  consentAtIso,
  previewDate,
  ariaHidden = false,
  nameMutedOverride,
}: EstimateAcceptTypedSignatureLineProps) {
  const trimmed = printedName.trim()
  const displayName = trimmed || placeholderName
  const nameMuted =
    nameMutedOverride !== undefined ? nameMutedOverride : !trimmed
  const dateLine = resolvedDateLine(consentAtIso, previewDate)

  return (
    <div
      aria-hidden={ariaHidden ? true : undefined}
      style={{
        width: '100%',
        boxSizing: 'border-box',
        borderBottom: '1px solid #d1d5db',
        paddingBottom: '0.35rem',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          gap: '0.75rem',
          flexWrap: 'wrap',
        }}
      >
        <div
          style={{
            fontFamily: ESTIMATE_ACCEPT_SIGNATURE_FONT,
            fontSize: '2rem',
            lineHeight: 1.25,
            wordBreak: 'break-word',
            minHeight: '2.5rem',
            minWidth: 0,
            flex: '1 1 auto',
            color: nameMuted ? '#6b7280' : '#111827',
          }}
        >
          {displayName}
        </div>
        <div
          style={{
            fontFamily: ESTIMATE_ACCEPT_SIGNATURE_FONT,
            fontSize: '1.2rem',
            lineHeight: 1.3,
            color: '#374151',
            flexShrink: 0,
            textAlign: 'right',
          }}
        >
          {dateLine}
        </div>
      </div>
    </div>
  )
}
