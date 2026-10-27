/**
 * The invented world's people, one per role (punch list #194). Their ids are fixed, so a frame's
 * session and every row that names them are the same each time. Kept apart from the world's rows,
 * because the seal needs a person before the world loads. Pure.
 */
import type { UserRole } from '../../hooks/useAuth'
import { HUMAN_ROLE_LABELS } from '../roleLabels'

export const LENS_ROLES = ['dev', 'master_technician', 'assistant', 'controller', 'estimator', 'primary', 'superintendent', 'subcontractor', 'helpers'] as const satisfies readonly UserRole[]
export type LensRole = (typeof LENS_ROLES)[number]

/** `label` is the app's own word for the role (`HUMAN_ROLE_LABELS`): Leader, never Master. */
export type LensPerson = { id: string; role: LensRole; name: string; email: string; phone: string; label: string }

const person = (n: string, role: LensRole, name: string): LensPerson => ({
  id: `00000000-0000-4194-8000-0000000000${n}`,
  role,
  name,
  email: `${name.split(' ')[0]!.toLowerCase()}@lens.example.com`,
  phone: `(512) 555-01${n}`,
  label: HUMAN_ROLE_LABELS[role],
})

export const LENS_PEOPLE: Readonly<Record<LensRole, LensPerson>> = {
  dev: person('01', 'dev', 'Devon Sample'),
  master_technician: person('02', 'master_technician', 'Max Sample'),
  assistant: person('03', 'assistant', 'Rosa Sample'),
  controller: person('04', 'controller', 'Cora Sample'),
  estimator: person('05', 'estimator', 'Eli Sample'),
  primary: person('06', 'primary', 'Paco Sample'),
  superintendent: person('07', 'superintendent', 'Sid Sample'),
  subcontractor: person('08', 'subcontractor', 'Sam Plumber'),
  helpers: person('09', 'helpers', 'Hal Sample'),
}
