/**
 * The Claude Desktop kickoff (v2.3207): the Robots → Queue lens copies
 * `docs/twins/kickoffs/desktop-operator.md` whole, with the one machine-specific
 * value filled in — the twin-mcp connector URL for the linked Supabase project.
 * The doc is the source of truth; this kernel only fills its placeholder, so
 * the copied prompt and the file never disagree.
 */

export const DESKTOP_KICKOFF_CONNECTOR_PLACEHOLDER = '{{CONNECTOR_URL}}'

/** The twin-mcp edge function door for a Supabase project URL (no trailing slash either way). */
export function twinMcpConnectorUrl(supabaseUrl: string): string {
  return `${supabaseUrl.trim().replace(/\/+$/, '')}/functions/v1/twin-mcp`
}

/**
 * Fill the kickoff template. Throws when the template lost its placeholder —
 * a copied prompt that still says `{{CONNECTOR_URL}}` would fail step 3 of the
 * setup silently on someone else's machine, so the build should fail instead.
 */
export function buildDesktopKickoff(template: string, opts: { connectorUrl: string }): string {
  if (!template.includes(DESKTOP_KICKOFF_CONNECTOR_PLACEHOLDER)) {
    throw new Error(`desktop kickoff template has no ${DESKTOP_KICKOFF_CONNECTOR_PLACEHOLDER} placeholder`)
  }
  return template.split(DESKTOP_KICKOFF_CONNECTOR_PLACEHOLDER).join(opts.connectorUrl)
}
