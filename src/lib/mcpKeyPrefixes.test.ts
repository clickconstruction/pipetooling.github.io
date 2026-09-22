import { describe, expect, it } from 'vitest'
import { DEV_MCP_KEY_PREFIX, TWIN_MCP_KEY_PREFIX, formatTwinMcpKey, mcpConnectorHeader, wrongDoorRefusal } from './mcpKeyPrefixes'
import { DEV_MCP_KEY_PREFIX as FROM_DEV_KEYS, formatDevMcpKey } from './devMcp/devMcpKeys'

describe('mcpKeyPrefixes', () => {
  it('prefixes a twin key, and the dev card reads the same dev prefix', () => {
    expect(formatTwinMcpKey('ab12')).toBe('ptt_ab12')
    expect(FROM_DEV_KEYS).toBe(DEV_MCP_KEY_PREFIX)
    expect(formatDevMcpKey('ab12')).toBe(`${DEV_MCP_KEY_PREFIX}ab12`)
    expect(TWIN_MCP_KEY_PREFIX).not.toBe(DEV_MCP_KEY_PREFIX)
  })

  it('writes the claude.ai connector header the same way for a twin key and a dev key', () => {
    expect(mcpConnectorHeader('ptt_ab12')).toBe('Bearer ptt_ab12')
    expect(mcpConnectorHeader(' ptd_ab12 ')).toBe('Bearer ptd_ab12')
  })

  it('refuses the other audience’s key, in the header or as a bearer', () => {
    expect(wrongDoorRefusal('/twin', { token: 'ptd_ab12' })).toBe(
      'This is a dev key (ptd_…) and this address is /twin — connect it to /dev instead.',
    )
    expect(wrongDoorRefusal('/twin', { authorization: 'Bearer ptd_ab12' })).toMatch(/connect it to \/dev/)
    expect(wrongDoorRefusal('/dev', { token: ' ptt_ab12 ' })).toBe(
      'This is a twin key (ptt_…) and this address is /dev — connect it to /twin instead.',
    )
    expect(wrongDoorRefusal('/dev', { authorization: 'bearer  ptt_ab12' })).toMatch(/connect it to \/twin/)
  })

  it('passes a bare key, no key, and the audience’s own prefix — the function decides those', () => {
    const bare = 'ab'.repeat(32)
    expect(wrongDoorRefusal('/twin', { token: bare })).toBeNull()
    expect(wrongDoorRefusal('/dev', { token: bare })).toBeNull()
    expect(wrongDoorRefusal('/twin', {})).toBeNull()
    expect(wrongDoorRefusal('/twin', { token: 'ptt_ab12', authorization: 'Bearer ptt_ab12' })).toBeNull()
    expect(wrongDoorRefusal('/dev', { token: 'ptd_ab12' })).toBeNull()
    // A prefix only counts at the front of the key, and only on a Bearer authorization.
    expect(wrongDoorRefusal('/twin', { token: 'abptd_12', authorization: 'Basic ptd_ab12' })).toBeNull()
  })
})
