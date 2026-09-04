import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { PdfPageCanvas } from '../formStudio/PdfPageCanvas'
import { FormFillOverlay, type SignaturePreview } from './FormFillOverlay'
import type { FormBox, FormSchema, FormValues } from '../../../lib/forms/formSchema'
import { acceptDigitsInput, boxHelp, boxLabel, displayValue, fillProgress, fillString, fitScale, hasAdvancedBoxes, lensSequence, setOneOfValue, toggleCheckbox, type FillLang } from '../../../lib/forms/formFillState'
import { useMatchMedia } from '../../../hooks/useMatchMedia'
import { CARD, COPPER, HAIR, INK, MUTED, NOTE_BAND as BAND, PAPER_RED } from '../../../lib/portal/portalTheme'

/**
 * Fill on the document (Contract Forms PR 3): the real page rendered with
 * inputs at the dev-placed boxes. On narrow screens a lens under the page
 * magnifies the current box (label, help, input) and steps in order; on wide
 * screens the signer types straight onto the page. Values are owned by the
 * parent (the signing page), which submits them with the signature.
 */

const LENS_QUERY = '(max-width: 760px)'

export function ContractFormFill({
  schema,
  templateUrl,
  values,
  onValuesChange,
  lang,
  onLangChange,
  errors,
  todayLabel,
  signature,
}: {
  schema: FormSchema
  templateUrl: string
  values: FormValues
  onValuesChange: (next: FormValues) => void
  lang: FillLang
  onLangChange: (lang: FillLang) => void
  errors: Record<string, string>
  todayLabel: string
  signature: SignaturePreview
}) {
  const narrow = useMatchMedia(LENS_QUERY)
  const [pdf, setPdf] = useState<ArrayBuffer | null>(null)
  const [pdfError, setPdfError] = useState<string | null>(null)
  const [containerWidth, setContainerWidth] = useState(0)
  const [focusedKey, setFocusedKey] = useState<string | null>(null)
  const [lensIndex, setLensIndex] = useState(0)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch(templateUrl)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const bytes = await res.arrayBuffer()
        if (!cancelled) setPdf(bytes)
      } catch (e) {
        if (!cancelled) setPdfError(e instanceof Error ? e.message : String(e))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [templateUrl])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const measure = () => setContainerWidth(el.clientWidth)
    measure()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    ro?.observe(el)
    window.addEventListener('resize', measure)
    return () => {
      ro?.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [])

  const firstPage = schema.pages[0] ?? { width: 612, height: 792 }
  const scale = fitScale(containerWidth, firstPage.width)
  const sequence = useMemo(() => lensSequence(schema, showAdvanced), [schema, showAdvanced])
  const progress = useMemo(() => fillProgress(schema, values), [schema, values])
  const current: FormBox | null = sequence[Math.min(lensIndex, Math.max(0, sequence.length - 1))] ?? null
  const t = (k: string, vars?: Record<string, string | number>) => fillString(lang, k, vars)

  const setText = useCallback(
    (box: FormBox, raw: string) => {
      if (box.oneOf) onValuesChange(setOneOfValue(schema, values, box.key, raw))
      else {
        const next = { ...values }
        if (raw === '') delete next[box.key]
        else next[box.key] = raw
        onValuesChange(next)
      }
    },
    [schema, values, onValuesChange],
  )
  const toggle = useCallback((key: string) => onValuesChange(toggleCheckbox(schema, values, key)), [schema, values, onValuesChange])

  function focusBox(key: string | null) {
    setFocusedKey(key)
    if (key) {
      const i = sequence.findIndex((b) => b.key === key)
      if (i >= 0) setLensIndex(i)
    }
  }

  function scrollBoxIntoView(key: string) {
    const el = containerRef.current?.querySelector<HTMLElement>(`[data-fill-key="${key}"]`)
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }

  function step(dir: -1 | 1) {
    const next = Math.min(sequence.length - 1, Math.max(0, lensIndex + dir))
    setLensIndex(next)
    const b = sequence[next]
    if (b) {
      setFocusedKey(b.key)
      scrollBoxIntoView(b.key)
    }
  }

  const pages = schema.pages.length > 0 ? schema.pages : [firstPage]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: COPPER }}>{t('fillTitle')}</div>
          <p style={{ margin: '0.15rem 0 0', fontSize: '0.875rem', color: MUTED, lineHeight: 1.45 }}>
            {t('fillIntro')} {narrow ? t('pinch') : ''}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <span style={{ fontSize: '0.8125rem', color: MUTED, fontVariantNumeric: 'tabular-nums' }}>{t('progress', { done: progress.done, total: progress.total })}</span>
          <button type="button" onClick={() => onLangChange(lang === 'es' ? 'en' : 'es')} style={pill}>
            {t('language')}
          </button>
        </div>
      </div>

      <div ref={containerRef} style={{ width: '100%', overflow: 'auto', border: `1px solid ${HAIR}`, borderRadius: 8, background: BAND, padding: '0.5rem' }}>
        {pdfError ? (
          <p style={{ margin: 0, padding: '1rem', color: PAPER_RED, fontSize: '0.875rem' }}>Could not load the form: {pdfError}</p>
        ) : !pdf ? (
          <p style={{ margin: 0, padding: '1rem', color: MUTED, fontSize: '0.875rem' }}>Loading the form…</p>
        ) : (
          pages.map((page, i) => (
            <div key={i} style={{ position: 'relative', width: page.width * scale, height: page.height * scale, margin: `${i === 0 ? 0 : 10}px auto 0`, boxShadow: '0 1px 4px rgba(0,0,0,.18)', background: CARD }}>
              <PdfPageCanvas bytes={pdf} page={i + 1} scale={scale} />
              <FormFillOverlay schema={schema} pageNo={i + 1} scale={scale} values={values} lang={lang} focusedKey={focusedKey} errors={errors} todayLabel={todayLabel} signature={signature} onFocus={focusBox} onText={setText} onToggle={toggle} />
            </div>
          ))
        )}
      </div>

      {hasAdvancedBoxes(schema) ? (
        <button type="button" onClick={() => setShowAdvanced((v) => !v)} style={{ ...pill, alignSelf: 'flex-start' }}>
          {showAdvanced ? t('hideRarely') : t('showRarely')}
        </button>
      ) : null}

      {narrow && current ? (
        <div style={{ background: CARD, border: `1px solid ${HAIR}`, borderRadius: 10, padding: '0.7rem 0.85rem' }}>
          <div style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '0.625rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: COPPER }}>
            {lensIndex + 1} {t('of')} {sequence.length} · {isRequiredBox(schema, current) ? t('required') : t('optional')}
          </div>
          <div style={{ fontSize: '0.95rem', fontWeight: 700, color: INK, margin: '0.15rem 0 0.4rem' }}>{boxLabel(current, lang)}</div>
          <LensInput box={current} schema={schema} values={values} lang={lang} onText={setText} onToggle={toggle} />
          {errors[current.key] ? <div style={{ fontSize: '0.75rem', color: PAPER_RED, marginTop: '0.3rem' }}>{errors[current.key]}</div> : null}
          {boxHelp(current, lang) ? <div style={{ fontSize: '0.75rem', color: MUTED, marginTop: '0.35rem', lineHeight: 1.45 }}>{boxHelp(current, lang)}</div> : null}
          {current.sensitive ? <div style={{ fontSize: '0.75rem', color: MUTED, marginTop: '0.25rem', lineHeight: 1.45 }}>{t('sensitiveNote')}</div> : null}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.6rem' }}>
            <button type="button" onClick={() => step(-1)} disabled={lensIndex === 0} style={pill}>
              ‹ {t('back')}
            </button>
            <button type="button" onClick={() => step(1)} disabled={lensIndex >= sequence.length - 1} style={{ ...pill, background: INK, color: CARD, borderColor: INK }}>
              {t('next')} ›
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function isRequiredBox(schema: FormSchema, box: FormBox): boolean {
  if (box.required) return true
  if (box.group) return schema.groups.find((g) => g.key === box.group)?.required ?? false
  if (box.oneOf) return schema.oneOfs.find((o) => o.key === box.oneOf)?.required ?? false
  return false
}

function LensInput({ box, schema, values, lang, onText, onToggle }: { box: FormBox; schema: FormSchema; values: FormValues; lang: FillLang; onText: (box: FormBox, raw: string) => void; onToggle: (key: string) => void }) {
  const [focused, setFocused] = useState(false)
  const inp: CSSProperties = { width: '100%', boxSizing: 'border-box', border: `1px solid ${INK}`, borderRadius: 6, padding: '0.6rem 0.7rem', fontSize: '1rem', fontFamily: box.type === 'digits' ? 'ui-monospace, Menlo, monospace' : 'inherit', letterSpacing: box.type === 'digits' ? '0.12em' : undefined, background: CARD, color: INK }
  if (box.type === 'checkbox') {
    const members = box.group ? schema.boxes.filter((b) => b.type === 'checkbox' && b.group === box.group) : [box]
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
        {members.length > 1 ? <div style={{ fontSize: '0.75rem', color: MUTED }}>{fillString(lang, 'checkOne')}</div> : null}
        {members.map((m) => {
          const on = values[m.key] === true
          return (
            <button key={m.key} type="button" role="checkbox" aria-checked={on} onClick={() => onToggle(m.key)} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', textAlign: 'left', background: on ? CARD : 'transparent', border: `1px solid ${on ? INK : HAIR}`, boxShadow: on ? `inset 0 0 0 1px ${INK}` : undefined, borderRadius: 8, padding: '0.55rem 0.7rem', fontSize: '0.9rem', color: INK, cursor: 'pointer', fontFamily: 'inherit' }}>
              <span aria-hidden style={{ width: 16, height: 16, borderRadius: 4, border: `2px solid ${on ? INK : MUTED}`, background: on ? INK : 'transparent', color: CARD, fontSize: 11, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {on ? '✓' : ''}
              </span>
              {boxLabel(m, lang)}
            </button>
          )
        })}
      </div>
    )
  }
  const v = values[box.key]
  return (
    <input
      type="text"
      inputMode={box.type === 'digits' ? 'numeric' : 'text'}
      autoComplete="off"
      aria-label={boxLabel(box, lang)}
      value={displayValue(box, v, focused)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChange={(e) => onText(box, box.type === 'digits' ? acceptDigitsInput(box, e.target.value) : e.target.value)}
      maxLength={box.type === 'text' && box.maxLength ? box.maxLength : undefined}
      style={inp}
    />
  )
}

const pill: CSSProperties = { background: 'transparent', border: `1px solid ${HAIR}`, borderRadius: 999, padding: '0.35rem 0.85rem', fontSize: '0.8125rem', fontWeight: 700, color: INK, cursor: 'pointer', fontFamily: 'inherit' }
