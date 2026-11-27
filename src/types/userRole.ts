/**
 * The nine roles an account can hold, as `users.role` stores them.
 *
 * Its home is here, under `src/types`, so the lowest layer can name a role without reading the sign-in hook
 * (punch list #434: a lower layer reads nothing from one above it, `npm run check:layers`). The hook
 * `src/hooks/useAuth.ts` exports it again, so a component or a page may read it from either.
 */
export type UserRole =
  | 'dev'
  | 'master_technician'
  | 'assistant'
  | 'subcontractor'
  | 'helpers'
  | 'estimator'
  | 'primary'
  | 'superintendent'
  | 'controller'
