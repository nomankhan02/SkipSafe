"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LayoutDashboard } from "lucide-react";
import { SSMonogram } from "@/components/SSMonogram";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NedConnection } from "@/components/NedConnection";
import { ReportUpload } from "@/components/ReportUpload";
import { Button } from "@/components/ui/button";
import {
  useReport,
  parseAndStoreReport,
  describeUploadError,
} from "@/lib/reportStore";
import { WEEKS_PER_SEMESTER, HARD_LIMIT } from "@/lib/attendance";

export default function ConnectPage() {
  const router = useRouter();
  const [report] = useReport();
  const [isParsing, setIsParsing] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleNedPdfRetrieved = async (
    buffer: ArrayBuffer,
    fileName: string,
  ) => {
    setIsParsing(true);
    setUploadError(null);
    try {
      await parseAndStoreReport(buffer, fileName);
      router.push("/dashboard");
    } catch (error) {
      setUploadError(describeUploadError(error));
      throw error;
    } finally {
      setIsParsing(false);
    }
  };

  const handleFileSelected = async (file: File) => {
    if (isParsing) return;
    setUploadError(null);

    const looksLikePdf =
      file.type === "application/pdf" || /\.pdf$/i.test(file.name);
    if (!looksLikePdf) {
      setUploadError("Please choose a PDF file.");
      return;
    }
    if (file.size === 0) {
      setUploadError("This PDF is empty.");
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      setUploadError("This PDF is larger than 25 MB. Choose a smaller report.");
      return;
    }

    setIsParsing(true);
    try {
      const buffer = await file.arrayBuffer();
      await parseAndStoreReport(buffer, file.name);
      router.push("/dashboard");
    } catch (error) {
      setUploadError(describeUploadError(error));
    } finally {
      setIsParsing(false);
    }
  };

  return (
    <main className="relative min-h-screen bg-background text-foreground antialiased selection:bg-primary/15">
      <div className="relative z-10 mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-9 space-y-7">
        <header className="border-b border-border pb-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-center gap-3.5">
              <SSMonogram className="size-10 shrink-0 text-foreground" />
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="font-bricolage text-xl leading-none font-bold tracking-tight text-foreground">
                    SkipSafe
                  </h1>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  <span>{WEEKS_PER_SEMESTER} Teaching Weeks</span>
                  <span aria-hidden="true">·</span>
                  <span>Exam Limit {HARD_LIMIT}%</span>
                  <span aria-hidden="true">·</span>
                  <span>Connect</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
              <ThemeToggle />

              {report && (
                <Link
                  href="/dashboard"
                  className="inline-flex h-8 items-center justify-center border border-border bg-transparent px-2.5 text-xs font-normal text-muted-foreground shadow-none hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <LayoutDashboard className="size-3.5 mr-1" />
                  View Dashboard
                </Link>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={() => {}}
                className="h-8 rounded-none border-border bg-transparent px-2.5 text-xs font-normal text-muted-foreground shadow-none hover:bg-muted hover:text-foreground"
              >
                Schedule changed? Ask SkipSafe.
              </Button>
            </div>
          </div>
        </header>

        {/* Connection Form */}
        <NedConnection onPdfRetrieved={handleNedPdfRetrieved} />

        {/* Manual Upload Fallback */}
        <section aria-labelledby="fallback-heading" className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2
              id="fallback-heading"
              className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground"
            >
              Manual Upload Fallback
            </h2>
            <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              PDF report
            </span>
          </div>

          <div className="space-y-3 border border-border bg-card p-3.5 sm:p-4">
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              If the NED portal is unavailable or you already have your report
              saved, upload the Course-Wise Attendance Analysis PDF directly.
            </p>

            <ReportUpload
              fileName={null}
              isParsing={isParsing}
              onFileSelected={handleFileSelected}
              onClear={() => {}}
            />

            {uploadError && (
              <p
                role="alert"
                className="border border-status-danger/40 bg-status-danger/10 p-2 text-xs text-status-danger"
              >
                {uploadError}
              </p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
