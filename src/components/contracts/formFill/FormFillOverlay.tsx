import type { CSSProperties } from 'react'
import { pdfRectToScreen, type FormBox, type FormPage, type FormSchema, type FormValues } from '../../../lib/forms/formSchema'
import { acceptDigitsInput, boxLabel, displayValue, type FillLang } from '../../../lib/forms/formFillState'
import { CARD, INK, PAPER_RED } from '../../../lib/portal/portalTheme'

/**
 * The inputs sitting on the rendered page (Contract Forms PR 3). Every box the
 * signer fills is an <input> or a checkbox button positioned at its rect;
 * constants and auto dates render as static text; the signature box previews
 * the typed name. Sensitive boxes show dots when not focused.
 */

export type SignaturePreview = { mode: 'type'; text: string } | null

export function FormFillOverlay({
  schema,
  pageNo,
  scale,
  values,
  lang,
  focusedKey,
  errors,
  todayLabel,
  signature,
  onFocus,
  onText,
  onToggle,
}: {
  schema: FormSchema
  pageNo: number
  scale: number
  values: FormValues
  lang: FillLang
  focusedKey: string | null
  errors: Record<string, string>
  todayLabel: string
  signature: SignaturePreview
  onFocus: (key: string | null) => void
  onText: (box: FormBox, raw: string) => void
  onToggle: (key: string) => void
}) {
  const page: FormPage = schema.pages[pageNo - 1] ?? { width: 612, height: 792 }
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      {schema.boxes
        .filter((b) => b.page === pageNo)
        .map((b) => {
          const r = pdfRectToScreen(b.rect, page, scale)
          const fontPx = Math.max(7, Math.min((b.fontSize ?? 10) * scale, r.height * 0.78))
          const base: CSSProperties = { position: 'absolute', left: r.left, top: r.top, width: r.width, height: r.height, boxSizing: 'border-box', fontSize: fontPx, lineHeight: 1, fontFamily: 'Helvetica, Arial, sans-serif', color: INK }
          const focused = focusedKey === b.key
          const err = errors[b.key]
          const frame = `1.5px solid ${err ? PAPER_RED : focused ? INK : 'rgba(176,102,47,0.55)'}`
          const label = boxLabel(b, lang)
          switch (b.type) {
            case 'text':
            case 'digits': {
              const v = values[b.key]
              const shown = displayValue(b, v, focused)
              return (
                <input
                  key={b.key}
                  type="text"
                  inputMode={b.type === 'digits' ? 'numeric' : 'text'}
                  autoComplete="off"
                  aria-label={label}
                  aria-invalid={err ? true : undefined}
                  data-fill-key={b.key}
                  value={shown}
                  onFocus={() => onFocus(b.key)}
                  onBlur={() => onFocus(null)}
                  onChange={(e) => onText(b, b.type === 'digits' ? acceptDigitsInput(b, e.target.value) : e.target.value)}
                  maxLength={b.type === 'text' && b.maxLength ? b.maxLength : undefined}
                  style={{ ...base, border: frame, borderRadius: 2, background: focused ? 'rgba(255,255,255,0.97)' : 'rgba(255,247,240,0.55)', padding: '0 3px', textAlign: b.align ?? 'left', outline: 'none', letterSpacing: b.type === 'digits' ? '0.08em' : undefined }}
                />
              )
            }
            case 'checkbox': {
              const checked = values[b.key] === true
              return (
                <button
                  key={b.key}
                  type="button"
                  role="checkbox"
                  aria-checked={checked}
                  aria-label={label}
                  data-fill-key={b.key}
                  onFocus={() => onFocus(b.key)}
                  onBlur={() => onFocus(null)}
                  onClick={() => onToggle(b.key)}
                  style={{ ...base, border: frame, borderRadius: 2, background: checked ? INK : 'rgba(255,247,240,0.6)', color: CARD, cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: Math.max(7, r.height * 0.8) }}
                >
                  {checked ? '✓' : ''}
                </button>
              )
            }
            case 'constant':
              return (
                <div key={b.key} aria-hidden style={{ ...base, display: 'flex', alignItems: 'center', padding: '0 3px', whiteSpace: 'pre-line', overflow: 'hidden', lineHeight: 1.15 }}>
                  {b.text}
                </div>
              )
            case 'date':
              if ((b.dateMode ?? 'today') === 'today') {
                return (
                  <div key={b.key} aria-hidden style={{ ...base, display: 'flex', alignItems: 'center', padding: '0 3px', overflow: 'hidden' }}>
                    {todayLabel}
                  </div>
                )
              }
              return (
                <input
                  key={b.key}
                  type="text"
                  aria-label={label}
                  data-fill-key={b.key}
                  value={typeof values[b.key] === 'string' ? (values[b.key] as string) : ''}
                  onFocus={() => onFocus(b.key)}
                  onBlur={() => onFocus(null)}
                  onChange={(e) => onText(b, e.target.value)}
                  style={{ ...base, border: frame, borderRadius: 2, background: 'rgba(255,247,240,0.55)', padding: '0 3px', outline: 'none' }}
                />
              )
            case 'signature':
              return (
                <div key={b.key} aria-hidden style={{ ...base, display: 'flex', alignItems: 'center', padding: '0 4px', overflow: 'hidden', fontFamily: '"Great Vibes", cursive', fontSize: Math.max(9, r.height * 0.85), color: signature?.text ? INK : 'rgba(22,40,60,0.35)', borderBottom: '1px dashed rgba(176,102,47,0.6)' }}>
                  {signature?.text || ''}
                </div>
              )
            default:
              return null
          }
        })}
    </div>
  )
}
