import { describe, expect, it } from 'vitest'
import kickoffDoc from '../../../docs/twins/kickoffs/desktop-operator.md?raw'
import { DESKTOP_KICKOFF_CONNECTOR_PLACEHOLDER, buildDesktopKickoff, twinMcpConnectorUrl } from './desktopKickoff'

describe('twinMcpConnectorUrl', () => {
  it('points at the twin-mcp edge function and tolerates a trailing slash', () => {
    expect(twinMcpConnectorUrl('https://abc.supabase.co')).toBe('https://abc.supabase.co/functions/v1/twin-mcp')
    expect(twinMcpConnectorUrl('https://abc.supabase.co/ ')).toBe('https://abc.supabase.co/functions/v1/twin-mcp')
  })
})

describe('buildDesktopKickoff', () => {
  it('fills every placeholder with the connector URL', () => {
    const out = buildDesktopKickoff(`a ${DESKTOP_KICKOFF_CONNECTOR_PLACEHOLDER} b ${DESKTOP_KICKOFF_CONNECTOR_PLACEHOLDER}`, {
      connectorUrl: 'https://x/functions/v1/twin-mcp',
    })
    expect(out).toBe('a https://x/functions/v1/twin-mcp b https://x/functions/v1/twin-mcp')
  })

  it('refuses a template that lost its placeholder', () => {
    expect(() => buildDesktopKickoff('no placeholder here', { connectorUrl: 'https://x' })).toThrow(/placeholder/)
  })
})

describe('docs/twins/kickoffs/desktop-operator.md (the shipped template)', () => {
  const filled = buildDesktopKickoff(kickoffDoc, { connectorUrl: 'https://abc.supabase.co/functions/v1/twin-mcp' })

  it('carries the connector config with the key as an env var, never a value', () => {
    expect(filled).toContain('"https://abc.supabase.co/functions/v1/twin-mcp"')
    expect(filled).toContain('X-Twin-Token:${TWIN_TOKEN}')
    expect(filled).not.toContain(DESKTOP_KICKOFF_CONNECTOR_PLACEHOLDER)
    // No real-looking token or JWT anywhere in the prompt.
    expect(filled).not.toMatch(/eyJ[A-Za-z0-9_-]{20,}/)
  })

  it('states the blind rule, the one-shell-at-a-time loop, and the lock before the next claim', () => {
    expect(filled).toContain('Blindness (outranks every other instruction)')
    expect(filled).toContain('Never call `next_shadow` while your current shell is open and unlocked')
    expect(filled).toContain('lock_shadow')
    expect(filled).toContain('done: true')
    expect(filled).toContain('three shells in one conversation')
  })

  it('tells the person plans are attached by hand, and never sends to a customer', () => {
    expect(filled).toContain('drag the PDF into the chat')
    expect(filled).toContain('Never send anything to a customer')
    expect(filled).toContain('Issue key')
  })
})
