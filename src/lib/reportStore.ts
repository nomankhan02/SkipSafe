"use client";

import { useSyncExternalStore } from "react";
import type { ParseResult } from "./parseReport";
import { analyzeCourse } from "./attendance";

export type LoadedReport = ParseResult & { fileName: string };

let currentReport: LoadedReport | null = null;
const listeners = new Set<() => void>();

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

export function getReport(): LoadedReport | null {
  return currentReport;
}

export function setReport(report: LoadedReport | null): void {
  currentReport = report;
  emitChange();
}

export function clearReport(): void {
  currentReport = null;
  emitChange();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): LoadedReport | null {
  return currentReport;
}

function getServerSnapshot(): LoadedReport | null {
  return null;
}

export function useReport(): [
  LoadedReport | null,
  (report: LoadedReport | null) => void,
] {
  const report = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );
  return [report, setReport];
}

export async function parseAndStoreReport(
  buffer: ArrayBuffer,
  fileName: string,
): Promise<LoadedReport> {
  const [{ configurePdfWorker }, { parseAttendanceReport }] =
    await Promise.all([
      import("@/lib/pdfWorker"),
      import("@/lib/parseReport"),
    ]);

  await configurePdfWorker();
  const result = await parseAttendanceReport(buffer);

  // Validate courses with existing attendance engine
  for (const course of result.courses) {
    analyzeCourse(course);
  }

  const loaded: LoadedReport = { ...result, fileName };
  setReport(loaded);
  return loaded;
}

export function describeUploadError(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (/layout not recognised/i.test(message)) {
    return "This PDF does not look like a supported attendance report. Check the file and try again.";
  }
  if (/password/i.test(message)) {
    return "This PDF is password-protected. Remove the password and try again.";
  }
  if (/invalid pdf|pdf structure|unexpected end|bad xref|format error/i.test(message)) {
    return "This file could not be read as a valid PDF. Check the file and try again.";
  }
  return "Could not parse this report. Check the file and try again.";
}

