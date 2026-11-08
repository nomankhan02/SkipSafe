/**
 * Browser-only PDF.js worker setup.
 *
 * parseReport.ts runs in both Node and the browser. Node resolves the worker
 * through the filesystem; in the browser we must point PDF.js at a bundled
 * worker asset before the first getDocument call.
 */

let workerConfigured = false;

export async function configurePdfWorker(): Promise<void> {
  if (workerConfigured || typeof window === "undefined") return;

  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "../../node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs",
      import.meta.url,
    ).toString();
  }

  workerConfigured = true;
}
