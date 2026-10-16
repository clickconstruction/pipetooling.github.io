/**
 * The tech's bio on the person's desk (v2.5587, punch list #114): **Luis's bio**, the office's lines about a tech in
 * the company's words, the bio as a customer gets it, the count against the cap, Spanish beside each line, the
 * tech's veto shown, and Add a line with six prompts shaped like a resume. The rules are `lib/bio/bio.ts`; the reads
 * and writes are `lib/bio/bioIo.ts` (`edit_bio_line`). Drawn for the office team on a person who presses On my way:
 * a primary, a helper, or an office member. A client ahead of the push draws nothing.
 */
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useConfirmDialog } from '../../../contexts/ConfirmDialogContext'
import { useToastContext } from '../../../contexts/ToastContext'
import type { PersonDeskViewer } from '../../../lib/people/personDeskGates'
import { formatErrorMessage } from '../../../utils/errorHandling'
import { BIO_CAP, BIO_PROMPTS, BIO_WORDS, bioLength, bioLengthWith, bioText, bioTitle, firstNameOf, leftWords, liveLines, type BioLine } from '../../../lib/bio/bio'
import { supabaseBioIo, type BioIo } from '../../../lib/bio/bioIo'
import { bioOnDesk } from '../../../lib/bio/bioGates'
import { BTN, BTN_BLUE, BTN_QUIET, Chip, DeskEmpty, DeskSection, deskBtn } from '../personDeskShared'

interface Form {
  /** The line being changed, or null for a new one. */
  id: string | null
  text: string
  es: string
}

const preview: CSSProperties = { background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.5rem 0.65rem', fontSize: '0.8125rem', color: 'var(--text-700)', whiteSpace: 'pre-wrap' }
const previewLabel: CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: '0.5rem', fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 2 }
const lineRow: CSSProperties = { display: 'grid', gridTemplateColumns: '1.25rem 1fr auto', gap: '0.35rem 0.6rem', alignItems: 'start', padding: '0.45rem 0', borderTop: '1px solid var(--border)' }
const num: CSSProperties = { fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', paddingTop: 2 }
const en: CSSProperties = { fontSize: '0.8125rem' }
const es: CSSProperties = { fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }
const off: CSSProperties = { color: 'var(--text-muted)', textDecoration: 'line-through' }
const actions: CSSProperties = { display: 'flex', gap: '0.35rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }
const field: CSSProperties = { width: '100%', fontSize: '0.8125rem', padding: '0.4rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 6, boxSizing: 'border-box', background: 'var(--surface)', color: 'var(--text-strong)', fontFamily: 'inherit' }
const chipBtn: CSSProperties = { border: '1px solid var(--border)', borderRadius: 999, padding: '0.1rem 0.55rem', fontSize: '0.75rem', background: 'var(--bg-subtle)', color: 'var(--text-700)', cursor: 'pointer' }
const count: CSSProperties = { fontSize: '0.6875rem', color: 'var(--text-muted)', textAlign: 'right', marginTop: 2 }

export function PersonDeskBioSection({
  userId,
  displayName,
  personRole,
  viewer,
  changeKey,
  io: ioProp,
}: {
  userId: string | null
  displayName: string
  personRole: string | null | undefined
  viewer: PersonDeskViewer
  changeKey: number
  /** For a smoke. */
  io?: BioIo
}) {
  const { showToast } = useToastContext()
  const confirmDialog = useConfirmDialog()
  const io = useMemo(() => ioProp ?? supabaseBioIo(), [ioProp])
  const shown = Boolean(userId) && bioOnDesk(viewer.role, personRole)
  /** `undefined` while reading; `null` when the push is not in. */
  const [lines, setLines] = useState<BioLine[] | null | undefined>(undefined)
  const [form, setForm] = useState<Form | null>(null)
  const [busy, setBusy] = useState(false)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!shown || !userId) return
    let live = true
    io.loadLines(userId).then(
      (l) => live && setLines(l),
      (e: unknown) => {
        if (!live) return
        setLines([])
        showToast(formatErrorMessage(e, 'The bio could not be read.'), 'error')
      },
    )
    return () => {
      live = false
    }
  }, [io, userId, shown, changeKey, tick, showToast])

  const first = firstNameOf(displayName) ?? 'They'
  const live = useMemo(() => liveLines(lines ?? []), [lines])
  const previewEn = useMemo(() => bioText({ lines: lines ?? [], first }), [lines, first])
  const previewEs = useMemo(() => bioText({ lines: lines ?? [], first, lang: 'es' }), [lines, first])
  const lengths = useMemo(() => (form ? bioLengthWith(lines ?? [], first, form.id, form.text, form.es) : null), [form, lines, first])
  const canEdit = shown && !viewer.readOnly
  const tooLong = lengths != null && (lengths.en > BIO_CAP || lengths.es > BIO_CAP)
  const canSave = Boolean(form?.text.trim()) && !tooLong && !busy

  if (!shown || lines === null || lines === undefined) return null

  const reload = () => setTick((t) => t + 1)

  const save = async () => {
    if (!form || !userId || !canSave) return
    setBusy(true)
    try {
      await io.editLine({ userId, id: form.id, text: form.text.trim(), textEs: form.es.trim() || null })
      showToast(form.id ? BIO_WORDS.saved : BIO_WORDS.added, 'success')
      setForm(null)
      reload()
    } catch (e) {
      showToast(formatErrorMessage(e, 'The line was not saved.'), 'error')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (line: BioLine) => {
    if (!userId) return
    const ok = await confirmDialog({ message: BIO_WORDS.removeAsk(first), confirmLabel: BIO_WORDS.removePress })
    if (!ok) return
    setBusy(true)
    try {
      await io.removeLine(userId, line.id)
      showToast(BIO_WORDS.removed, 'success')
      if (form?.id === line.id) setForm(null)
      reload()
    } catch (e) {
      showToast(formatErrorMessage(e, 'The line was not removed.'), 'error')
    } finally {
      setBusy(false)
    }
  }

  const formBox = form ? (
    <div style={{ display: 'grid', gap: '0.35rem', gridColumn: '1 / -1' }} data-testid="desk-bio-form">
      {form.id === null ? (
        <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
          {BIO_PROMPTS.map((p) => (
            <button key={p.label} type="button" style={chipBtn} disabled={busy} onClick={() => setForm({ ...form, text: p.starter(first) })}>
              {p.label}
            </button>
          ))}
        </div>
      ) : null}
      <textarea rows={2} style={field} value={form.text} placeholder={BIO_WORDS.linePlaceholder(first)} aria-label="The line" disabled={busy} onChange={(e) => setForm({ ...form, text: e.target.value })} />
      <input style={field} value={form.es} placeholder={BIO_WORDS.esPlaceholder} aria-label="The same in Spanish" disabled={busy} onChange={(e) => setForm({ ...form, es: e.target.value })} />
      <div style={{ ...count, color: tooLong ? 'var(--text-red-600)' : 'var(--text-muted)' }} data-testid="desk-bio-count">
        {lengths ? (lengths.es > 0 ? `${leftWords(lengths.en)} · Spanish ${leftWords(lengths.es)}` : leftWords(lengths.en)) : null}
      </div>
      <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end' }}>
        <button type="button" style={deskBtn(BTN_QUIET, busy)} disabled={busy} onClick={() => setForm(null)}>
          {BIO_WORDS.cancel}
        </button>
        <button type="button" style={deskBtn(BTN_BLUE, !canSave)} disabled={!canSave} onClick={() => void save()}>
          {busy ? 'Saving…' : form.id ? BIO_WORDS.save : BIO_WORDS.addPress}
        </button>
      </div>
    </div>
  ) : null

  return (
    <DeskSection id="bio" title={bioTitle(first)} who="the office">
      <div data-testid="desk-bio">
        <p style={{ margin: '0 0 0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{BIO_WORDS.deskHint(first)}</p>
        {live.length === 0 ? (
          <DeskEmpty>{BIO_WORDS.deskEmpty(first)}</DeskEmpty>
        ) : (
          <>
            <div style={previewLabel}>
              <span>{BIO_WORDS.preview}</span>
              <span data-testid="desk-bio-left">{leftWords(bioLength(lines, first))}</span>
            </div>
            <p style={{ ...preview, margin: 0 }} data-testid="desk-bio-preview">
              {previewEn ?? 'Nothing goes while every line is off.'}
            </p>
            {previewEs ? (
              <>
                <div style={{ ...previewLabel, marginTop: '0.4rem' }}>
                  <span>{BIO_WORDS.previewEs}</span>
                  <span>{leftWords(bioLength(lines, first, 'es'))}</span>
                </div>
                <p style={{ ...preview, margin: 0 }} data-testid="desk-bio-preview-es">
                  {previewEs}
                </p>
              </>
            ) : null}
          </>
        )}
        <div style={{ marginTop: '0.5rem' }}>
          {live.map((line, i) =>
            form?.id === line.id ? (
              <div key={line.id} style={lineRow}>
                {formBox}
              </div>
            ) : (
              <div key={line.id} style={lineRow} data-testid="desk-bio-line">
                <span style={num}>{i + 1}</span>
                <div style={line.offByUser ? off : undefined}>
                  <div style={en}>{line.text}</div>
                  {line.textEs ? (
                    <div style={es}>{line.textEs}</div>
                  ) : (
                    <div style={{ ...es, color: 'var(--text-amber-800)', fontStyle: 'italic' }}>{BIO_WORDS.noSpanish}</div>
                  )}
                </div>
                <div style={actions}>
                  {line.offByUser ? <Chip tone="amber">{BIO_WORDS.turnedOff(first)}</Chip> : null}
                  {canEdit ? (
                    <>
                      <button type="button" style={deskBtn(BTN, busy)} disabled={busy} onClick={() => setForm({ id: line.id, text: line.text, es: line.textEs ?? '' })}>
                        {BIO_WORDS.edit}
                      </button>
                      <button type="button" style={deskBtn(BTN_QUIET, busy)} disabled={busy} onClick={() => void remove(line)}>
                        {BIO_WORDS.remove}
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
            ),
          )}
        </div>
        {canEdit ? (
          form && form.id === null ? (
            <div style={{ ...lineRow, gridTemplateColumns: '1fr' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-700)' }}>
                {BIO_WORDS.addTitle} <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>· {BIO_WORDS.addHint}</span>
              </div>
              {formBox}
            </div>
          ) : (
            <div style={{ marginTop: '0.5rem' }}>
              <button type="button" style={deskBtn(BTN, busy)} disabled={busy} onClick={() => setForm({ id: null, text: '', es: '' })} data-testid="desk-bio-add">
                + {BIO_WORDS.addTitle}
              </button>
            </div>
          )
        ) : null}
      </div>
    </DeskSection>
  )
}
