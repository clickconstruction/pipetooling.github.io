/**
 * Equipment pre-use check (punch list #270): the words a machine's Drive folder is named by. Pure, no imports, so the
 * app's test (`src/lib/machines/machineFolder.test.ts`) holds them and the sweep and the phone agree.
 */
export interface MachineFolderInput {
  unit_label: string | null
  make: string
  model: string
  rental_from: string | null
  rental_agreement_no: string | null
}

/** `E-12 · Kubota KX040`, or `Rental · Sunbelt 48812-3 · Bobcat E35` for a rented one, so a claim finds it by the agreement. */
export function machineFolderName(m: MachineFolderInput): string {
  const makeModel = `${m.make} ${m.model}`.trim()
  const from = (m.rental_from ?? '').trim()
  const agreement = (m.rental_agreement_no ?? '').trim()
  if (from || agreement) return `Rental · ${[from, agreement].filter(Boolean).join(' ')} · ${makeModel}`
  const unit = (m.unit_label ?? '').trim()
  return unit ? `${unit} · ${makeModel}` : makeModel
}
