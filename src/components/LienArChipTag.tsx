import type { CSSProperties } from 'react'
import { StagesGavelGlyph } from './jobs/StagesRowActionButtons'
import type { LienArChip, LienArCustomerChip, LienArTone } from '../lib/jobs/lienArChip'

/**
 * The lien chip (v2.5488): a few words in the desk's tone, the gavel before them. On a job row
 * it is the door to the Lien desk or the job's Lien window; on a customer header it only says
 * the worst state. Saturated status colors stay the theme's tint tokens, so it reads in dark mode.
 */
const TONES: Record<LienArTone, { bg: string; fg: string; border: string }> = {
  red: { bg: 'var(--bg-red-tint)', fg: 'var(--text-red-600)', border: 'var(--bg-red-tint)' },
  amber: { bg: 'var(--bg-amber-tint)', fg: 'var(--text-amber-800)', border: 'var(--bg-amber-tint)' },
  green: { bg: 'var(--bg-green-tint)', fg: 'var(--text-green-800)', border: 'var(--bg-green-tint)' },
  blue: { bg: 'var(--bg-blue-tint)', fg: 'var(--text-blue-800)', border: 'var(--bg-blue-tint)' },
  muted: { bg: 'var(--bg-muted)', fg: 'var(--text-muted)', border: 'var(--border)' },
}

function chipStyle(tone: LienArTone, pressable: boolean): CSSProperties {
  const t = TONES[tone]
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.3rem',
    padding: '1px 8px',
    borderRadius: 999,
    border: `1px solid ${t.border}`,
    background: t.bg,
    color: t.fg,
    font: 'inherit',
    fontSize: '0.7rem',
    fontWeight: 700,
    lineHeight: 1.5,
    whiteSpace: 'nowrap',
    maxWidth: '100%',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    cursor: pressable ? 'pointer' : 'default',
    flexShrink: 0,
  }
}

/** The job row's chip: a button that opens the chip's door. */
export function LienArChipButton({ chip, onOpen }: { chip: LienArChip; onOpen: (chip: LienArChip) => void }) {
  return (
    <button
      type="button"
      data-testid="ar-lien-chip"
      data-tone={chip.tone}
      title={chip.title}
      aria-label={`${chip.words} — ${chip.title}`}
      onClick={(e) => {
        e.stopPropagation()
        onOpen(chip)
      }}
      style={chipStyle(chip.tone, true)}
    >
      <span aria-hidden="true" style={{ display: 'inline-flex', flexShrink: 0 }}>
        <StagesGavelGlyph size={11} />
      </span>
      {chip.words}
    </button>
  )
}

/** The customer header's chip: the worst state, every job's words on hover. */
export function LienArCustomerChipTag({ chip }: { chip: LienArCustomerChip }) {
  return (
    <span data-testid="ar-lien-customer-chip" data-tone={chip.tone} title={chip.title} style={{ ...chipStyle(chip.tone, false), flexShrink: 1, minWidth: 0 }}>
      <span aria-hidden="true" style={{ display: 'inline-flex', flexShrink: 0 }}>
        <StagesGavelGlyph size={11} />
      </span>
      {chip.words}
    </span>
  )
}

/** The line under a bill: the chip, then the desk's sentence in plain words. */
export function LienArChipLine({ chip, onOpen, indent }: { chip: LienArChip; onOpen: (chip: LienArChip) => void; indent?: string }) {
  return (
    <div data-testid="ar-lien-line" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', margin: `0.2rem 0 0 ${indent ?? '0'}`, fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
      <LienArChipButton chip={chip} onOpen={onOpen} />
      <span style={{ minWidth: 0 }}>{chip.sentence}</span>
    </div>
  )
}
