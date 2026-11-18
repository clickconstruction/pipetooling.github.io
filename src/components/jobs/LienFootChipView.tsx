import type { LienFootChip } from '../../lib/jobs/lienFootChip'

/** The footer's state chip (v2.4855): a few words, the old sentence on hover. Shared by the Lien desk's footers (out of `LienDesk.tsx`). */
export function LienFootChipView({ chip, ...rest }: { chip: LienFootChip } & Record<`data-${string}`, string | boolean | undefined>) {
  return (
    <span className="lienFootChip" data-tone={chip.tone} title={chip.title} {...rest}>
      {chip.tone === 'green' ? <span aria-hidden="true">✓</span> : null}
      {chip.words}
    </span>
  )
}
