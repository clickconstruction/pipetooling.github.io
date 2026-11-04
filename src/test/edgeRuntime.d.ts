/**
 * What the edge functions' shared files need of Deno's runtime when a test under `src/` imports one of them and the
 * app's typecheck follows the import (v2.6491: `src/lib/documents/fileIndexPasses.test.ts` runs the file index's
 * passes in `supabase/functions/_shared/fileIndex.ts` against a recording client). The functions run on Deno, which
 * has these; the app never does, so each is the narrowest shape the shared files use. The Deno-style module names
 * (`https://esm.sh/@supabase/supabase-js@2`, `npm:@supabase/supabase-js@2`) resolve to the installed package through
 * `paths` in `tsconfig.json`; `npm:unpdf@2.1.0` is a dynamic import the index's PDF read makes, declared here since the
 * package is not installed.
 */

/** `Deno.env.get`, read by `ocrSetup`, `embeddingsSetup` and the Drive settings at call time. */
declare const Deno: {
  env: { get(name: string): string | undefined }
}

/** unpdf's document proxy, as `fileText.ts` reads it: the page count, pdf.js's pages through `PdfDoc`, the loading task to destroy. */
declare module 'npm:unpdf@2.1.0' {
  export function getDocumentProxy(data: Uint8Array): Promise<{
    numPages: number
    getPage(n: number): Promise<{ getTextContent(): Promise<{ items: readonly unknown[] }>; cleanup?: () => unknown }>
    loadingTask?: { destroy?: () => unknown }
  }>
}
