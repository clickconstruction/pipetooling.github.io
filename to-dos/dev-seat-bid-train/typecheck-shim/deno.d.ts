declare const Deno: { env: { get(k: string): string | undefined } }
declare module 'https://deno.land/std@0.168.0/http/server.ts' { export function serve(h: (req: Request) => Response | Promise<Response>): void }
