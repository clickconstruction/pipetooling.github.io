import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent } from 'react'
import {
  STAGE_COLORS,
  STAGE_KEYS,
  STAGE_LABELS,
  STAGE_NUMBER,
  describeSplitLong,
  describeWeights,
  normalizeWeights,
  parseSharesText,
  stagesOf,
  toggleStage,
  type StageSplitScope,
  type StageSplitSource,
  type StageWeights,
} from '../../lib/bids/materialsByStage'
import type { TakeoffStage } from '../../lib/bids/bidTakeoffHelpers'

/**
 * Materials by stage (v2.3672): the three boxes — 1 Rough In · 2 Top Out ·
 * 3 Trim Set — under a fixture, a part line, or a part inside an assembly.
 * Click lights a stage (two lit = an even split), Shift-click makes it the only
 * one, and the split text beside them opens to type the shares (70 / 30). A
 * scope with no split of its own shows the inherited one dimmed; ↺ returns a
 * line to "same as fixture".
 */

export type StageSplitChipsProps = {
  /** The split stored at this scope; null when none. */
  value: StageWeights | null
  /** What applies when `value` is null (from the scope above); shown dimmed. */
  inherited?: StageWeights | null
  inheritedFrom?: StageSplitScope | 'assembly' | null
  source?: StageSplitSource | null
  /** The scope the chips edit; a fixture never shows ↺. */
  scope: StageSplitScope
  /** What the chips are for, for screen readers and tooltips: "SK-1", "BRKT-170-LF in SK-1 assembly". */
  label: string
  onChange: (next: StageWeights | null) => void
  size?: 'md' | 'sm'
  disabled?: boolean
}

const box = (size: 'md' | 'sm'): CSSProperties => ({
  width: size === 'md' ? 22 : 18,
  height: size === 'md' ? 22 : 18,
  borderRadius: 4,
  border: '1px solid var(--border)',
  background: 'var(--bg-subtle)',
  color: 'var(--text-faint)',
  fontFamily: 'ui-monospace, Menlo, monospace',
  fontSize: size === 'md' ? '0.72rem' : '0.64rem',
  fontWeight: 700,
  lineHeight: 1,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
  cursor: 'pointer',
})

export function StageSplitChips({ value, inherited = null, inheritedFrom = null, source = null, scope, label, onChange, size = 'md', disabled = false }: StageSplitChipsProps) {
  const own = normalizeWeights(value) ? value : null
  const shown = own ?? (normalizeWeights(inherited) ? inherited : null)
  const lit = new Set(stagesOf(shown))
  const isInherited = !own && !!shown
  const [typing, setTyping] = useState(false)
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement | null>(null)
  useEffect(() => {
    if (typing) inputRef.current?.focus()
  }, [typing])

  const click = (stage: TakeoffStage) => (e: MouseEvent<HTMLButtonElement>) => {
    if (disabled) return
    // A click on an inherited split starts from that split, so one click adds or drops a stage of it.
    onChange(toggleStage(shown, stage, e.shiftKey))
  }
  const key = (stage: TakeoffStage) => (e: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return
    if (e.key === '1' || e.key === '2' || e.key === '3') {
      e.preventDefault()
      const k = STAGE_KEYS[Number(e.key) - 1]
      if (k) onChange(toggleStage(shown, k, e.shiftKey))
      return
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onChange(toggleStage(shown, stage, e.shiftKey))
    }
  }
  const commitDraft = () => {
    const litList = stagesOf(shown)
    const parsed = parseSharesText(draft, litList)
    setTyping(false)
    if (parsed) onChange(parsed)
  }
  const splitText = describeWeights(shown)
  const litList = stagesOf(shown)
  const title = `${label}: ${describeSplitLong(shown)}${isInherited ? ` (${inheritedFrom === 'assembly' ? 'what the assembly remembers' : `from the ${inheritedFrom ?? 'fixture'}`})` : source === 'rule' ? ' (by rule)' : source === 'book' ? ' (from the book)' : source === 'assembly' ? ' (from the assembly)' : ''}`

  return (
    <span
      data-testid="stage-split-chips"
      data-scope={scope}
      data-own={own ? '1' : '0'}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 3, opacity: disabled ? 0.5 : 1 }}
      title={title}
      role="group"
      aria-label={`Stage for ${label}`}
    >
      {STAGE_KEYS.map((stage) => {
        const on = lit.has(stage)
        const color = STAGE_COLORS[stage]
        const style: CSSProperties = {
          ...box(size),
          ...(on
            ? isInherited
              ? { background: 'transparent', borderColor: color, borderStyle: 'dashed', color }
              : { background: color, borderColor: color, color: '#fff' }
            : {}),
        }
        return (
          <button
            key={stage}
            type="button"
            onClick={click(stage)}
            onKeyDown={key(stage)}
            disabled={disabled}
            aria-pressed={on}
            aria-label={`${STAGE_NUMBER[stage]} ${STAGE_LABELS[stage]}${on ? (isInherited ? ', inherited' : ', on') : ''}`}
            style={style}
          >
            {STAGE_NUMBER[stage]}
          </button>
        )
      })}
      {litList.length > 1 ? (
        typing ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitDraft}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                commitDraft()
              } else if (e.key === 'Escape') {
                e.preventDefault()
                setTyping(false)
              }
              e.stopPropagation()
            }}
            aria-label={`Shares for ${litList.map((k) => STAGE_LABELS[k]).join(' and ')}`}
            placeholder={litList.length === 2 ? '70 / 30' : '50 / 30 / 20'}
            style={{ width: 66, marginLeft: 4, padding: '1px 4px', fontSize: '0.72rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', color: 'inherit' }}
          />
        ) : (
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              const n = normalizeWeights(shown)
              setDraft(n ? litList.map((k) => String(Math.round(n[k] * 100))).join(' / ') : '')
              setTyping(true)
            }}
            title="Type the shares — 70 / 30"
            aria-label={`Change the shares (${splitText})`}
            style={{ marginLeft: 4, background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: size === 'md' ? '0.72rem' : '0.66rem', color: isInherited ? 'var(--text-faint)' : 'var(--text-muted)', fontVariantNumeric: 'tabular-nums', textDecoration: 'underline dotted', textUnderlineOffset: 2 }}
          >
            {splitText}
          </button>
        )
      ) : null}
      {own && scope !== 'fixture' ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange(null)}
          title={scope === 'part' ? 'Same as the assembly line' : 'Same as the fixture'}
          aria-label={scope === 'part' ? 'Follow the assembly line again' : 'Follow the fixture again'}
          style={{ marginLeft: 2, background: 'none', border: 'none', padding: '0 2px', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--text-faint)', lineHeight: 1 }}
        >
          ↺
        </button>
      ) : null}
    </span>
  )
}
