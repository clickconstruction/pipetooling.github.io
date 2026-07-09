/**
 * Help-guide content model: frontmatter parsing + registry building for the
 * markdown guides bundled from src/content/help/*.md (slug = filename).
 *
 * Frontmatter is intentionally tiny — `key: value` lines between `---` fences,
 * no YAML library. `roles` is a RELEVANCE filter (what the /help page shows a
 * role by default), not access control: "Show all" reveals every guide.
 *
 * buildHelpGuideRegistry THROWS on malformed content so a bad guide fails
 * loudly in dev and in CI (src/lib/helpGuideContent.test.ts runs it over the
 * real content directory).
 */
import type { UserRole } from '../hooks/useAuth'
import { ROLES } from './userRoles'

export type HelpGuide = {
  slug: string
  title: string
  category: string
  /** 'all' or the roles this guide is relevant to by default. */
  roles: UserRole[] | 'all'
  keywords: string[]
  /** Sort position within the category; guides without `order:` sink to 999. */
  order: number
  /** Markdown after the frontmatter block. */
  body: string
}

const DEFAULT_ORDER = 999

/** '../content/help/job-mode-clocking.md' → 'job-mode-clocking'. */
export function helpGuideSlugFromGlobPath(path: string): string {
  const base = path.slice(path.lastIndexOf('/') + 1)
  return base.endsWith('.md') ? base.slice(0, -3) : base
}

/**
 * Split a guide source into frontmatter fields and body. Tolerates CRLF and a
 * missing frontmatter block (fields = {}). Unknown keys are kept (and ignored
 * by the registry builder) so future additions don't break old clients.
 */
export function parseHelpGuideFrontmatter(source: string): {
  fields: Record<string, string>
  body: string
} {
  const normalized = source.replace(/\r\n/g, '\n')
  if (!normalized.startsWith('---\n')) {
    return { fields: {}, body: normalized }
  }
  const end = normalized.indexOf('\n---', 4)
  if (end === -1) {
    return { fields: {}, body: normalized }
  }
  const block = normalized.slice(4, end)
  const afterFence = normalized.indexOf('\n', end + 1)
  const body = afterFence === -1 ? '' : normalized.slice(afterFence + 1)
  const fields: Record<string, string> = {}
  for (const line of block.split('\n')) {
    const colon = line.indexOf(':')
    if (colon === -1) continue
    const key = line.slice(0, colon).trim()
    const value = line.slice(colon + 1).trim()
    if (key) fields[key] = value
  }
  return { fields, body }
}

function parseRoles(value: string, slug: string): UserRole[] | 'all' {
  if (value.trim().toLowerCase() === 'all') return 'all'
  const parts = value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  if (parts.length === 0) {
    throw new Error(`Help guide "${slug}": roles is empty (use "all" or a comma-separated role list)`)
  }
  const roles: UserRole[] = []
  for (const p of parts) {
    if (!(ROLES as string[]).includes(p)) {
      throw new Error(`Help guide "${slug}": unknown role "${p}" (valid: all, ${ROLES.join(', ')})`)
    }
    roles.push(p as UserRole)
  }
  return roles
}

/**
 * Build the validated, sorted guide registry from an import.meta.glob record
 * (path → raw markdown). Sort: category A–Z, then order, then title A–Z.
 */
export function buildHelpGuideRegistry(rawBySourcePath: Record<string, string>): HelpGuide[] {
  const guides: HelpGuide[] = []
  const seen = new Set<string>()
  for (const [path, source] of Object.entries(rawBySourcePath)) {
    const slug = helpGuideSlugFromGlobPath(path)
    if (seen.has(slug)) {
      throw new Error(`Help guide "${slug}": duplicate slug`)
    }
    seen.add(slug)
    const { fields, body } = parseHelpGuideFrontmatter(source)
    const title = (fields.title ?? '').trim()
    const category = (fields.category ?? '').trim()
    if (!title) throw new Error(`Help guide "${slug}": missing required frontmatter "title"`)
    if (!category) throw new Error(`Help guide "${slug}": missing required frontmatter "category"`)
    if (!(fields.roles ?? '').trim()) {
      throw new Error(`Help guide "${slug}": missing required frontmatter "roles"`)
    }
    if (!body.trim()) throw new Error(`Help guide "${slug}": empty body`)
    const orderRaw = Number.parseInt((fields.order ?? '').trim(), 10)
    guides.push({
      slug,
      title,
      category,
      roles: parseRoles(fields.roles!, slug),
      keywords: (fields.keywords ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      order: Number.isFinite(orderRaw) ? orderRaw : DEFAULT_ORDER,
      body,
    })
  }
  guides.sort(
    (a, b) =>
      a.category.localeCompare(b.category) ||
      a.order - b.order ||
      a.title.localeCompare(b.title),
  )
  return guides
}

/**
 * Default-relevance filter for the /help list. Null role (auth still loading)
 * and dev (admin-like everywhere else) see everything.
 */
export function guideIsRelevantForRole(guide: HelpGuide, role: UserRole | null): boolean {
  if (guide.roles === 'all') return true
  if (role === null || role === 'dev') return true
  return guide.roles.includes(role)
}

export function groupGuidesByCategory(
  guides: readonly HelpGuide[],
): Array<{ category: string; guides: HelpGuide[] }> {
  const out: Array<{ category: string; guides: HelpGuide[] }> = []
  for (const g of guides) {
    const last = out[out.length - 1]
    if (last && last.category === g.category) last.guides.push(g)
    else out.push({ category: g.category, guides: [g] })
  }
  return out
}
