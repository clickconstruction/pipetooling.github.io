import { describe, expect, it } from 'vitest'
import { WALK_ENV_KEYS, layerEnv, missingKeyWords, missingKeys, parseEnvText } from './walkEnv'

describe('parseEnvText', () => {
  it('reads KEY=value lines, drops the quotes, and leaves comments, blanks and empty values out', () => {
    const text = ['# the keys', 'VITE_SUPABASE_URL=https://x.supabase.co', '', 'VITE_SUPABASE_ANON_KEY="anon-1234"', "export VITE_DEV_LOGIN_SECRET='s3cret'", 'EMPTY=', '  SPACED = v  ', 'lower=no', 'not a line'].join('\n')
    expect(parseEnvText(text)).toEqual({ VITE_SUPABASE_URL: 'https://x.supabase.co', VITE_SUPABASE_ANON_KEY: 'anon-1234', VITE_DEV_LOGIN_SECRET: 's3cret', SPACED: 'v' })
  })
})

describe('layerEnv', () => {
  it('lays .env.local over .env: a value in the later file wins, an empty one sets nothing, a file not there is listed', () => {
    const layered = layerEnv([
      { name: '/main/.env', text: 'VITE_SUPABASE_URL=https://x.supabase.co\nVITE_SUPABASE_ANON_KEY=anon-from-env\n' },
      { name: '/main/.env.local', text: 'VITE_SUPABASE_ANON_KEY=anon-from-local\nVITE_SUPABASE_URL=\nVITE_DEV_LOGIN_SECRET=s3cret\n' },
    ])
    expect(layered).toEqual({
      env: { VITE_SUPABASE_URL: 'https://x.supabase.co', VITE_SUPABASE_ANON_KEY: 'anon-from-local', VITE_DEV_LOGIN_SECRET: 's3cret' },
      read: ['/main/.env', '/main/.env.local'],
      notFound: [],
    })
    expect(layerEnv([{ name: '/main/.env', text: null }, { name: '/main/.env.local', text: 'VITE_DEV_LOGIN_SECRET=s3cret' }])).toEqual({ env: { VITE_DEV_LOGIN_SECRET: 's3cret' }, read: ['/main/.env.local'], notFound: ['/main/.env'] })
  })
})

describe('missingKeyWords', () => {
  const all = { VITE_SUPABASE_URL: 'https://x.supabase.co', VITE_SUPABASE_ANON_KEY: 'anon', VITE_DEV_LOGIN_SECRET: 's3cret' }

  it('is null when every key has a value', () => {
    expect(missingKeys(all)).toEqual([])
    expect(missingKeyWords({ env: all, read: ['/main/.env.local'], notFound: ['/main/.env'] })).toBeNull()
  })

  it('names the missing key, the files read and the file not there', () => {
    expect(missingKeyWords({ env: { VITE_SUPABASE_URL: all.VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY: all.VITE_SUPABASE_ANON_KEY }, read: ['/main/.env.local'], notFound: ['/main/.env'] })).toBe(
      'VITE_DEV_LOGIN_SECRET is missing (read /main/.env.local; /main/.env not found). The walk needs VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY and VITE_DEV_LOGIN_SECRET, in the main checkout’s .env or .env.local.',
    )
    expect(missingKeyWords({ env: { VITE_DEV_LOGIN_SECRET: 's3cret' }, read: ['/main/.env', '/main/.env.local'], notFound: [] })).toBe(
      'VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are missing (read /main/.env and /main/.env.local). The walk needs VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY and VITE_DEV_LOGIN_SECRET, in the main checkout’s .env or .env.local.',
    )
  })

  it('names every key when neither file is there', () => {
    expect(missingKeyWords({ env: {}, read: [], notFound: ['/main/.env', '/main/.env.local'] })).toBe(
      `${WALK_ENV_KEYS.slice(0, -1).join(', ')} and ${WALK_ENV_KEYS[2]} are missing (/main/.env and /main/.env.local not found). The walk needs VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY and VITE_DEV_LOGIN_SECRET, in the main checkout’s .env or .env.local.`,
    )
  })
})
