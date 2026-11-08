"use client";

import { useSyncExternalStore, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { MOCK_COURSES } from "@/lib/mockCourses";
import {
  analyzeCourse,
  getAttendanceSummary,
  WEEKS_PER_SEMESTER,
  HARD_LIMIT,
  type Status,
} from "@/lib/attendance";
import type { ParseResult } from "@/lib/parseReport";
import { Button } from "@/components/ui/button";
import { SSMonogram } from "@/components/SSMonogram";
import { AttendanceScale } from "@/components/AttendanceScale";
import { ParseNotices } from "@/components/ParseNotices";
import { ReportUpload } from "@/components/ReportUpload";
import { NedConnection } from "@/components/NedConnection";
import {
  StatusSymbol,
  getStatusSymbolState,
  type StatusSymbolState,
} from "@/components/StatusSymbol";
import { Info } from "lucide-react";

type LoadedReport = ParseResult & { fileName: string };

function describeUploadError(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (/layout not recognised/i.test(message)) {
    return "This PDF does not look like a supported attendance report. The previous report, if any, is still shown.";
  }
  if (/password/i.test(message)) {
    return "This PDF is password-protected. Remove the password and try again.";
  }
  if (/invalid pdf|pdf structure|unexpected end|bad xref|format error/i.test(message)) {
    return "This file could not be read as a valid PDF. The previous report, if any, is still shown.";
  }
  return "Could not parse this report. Check the file and try again. The previous report, if any, is still shown.";
}

const STATUS_CONFIG: Record<
  Status,
  {
    label: string;
    textClass: string;
    bgSubtleClass: string;
  }
> = {
  safe: {
    label: "Safe",
    textClass: "text-status-safe",
    bgSubtleClass: "bg-status-safe/10",
  },
  warning: {
    label: "Warning",
    textClass: "text-status-warning",
    bgSubtleClass: "bg-status-warning/10",
  },
  danger: {
    label: "Danger",
    textClass: "text-status-danger",
    bgSubtleClass: "bg-status-danger/10",
  },
  not_started: {
    label: "Not started",
    textClass: "text-muted-foreground",
    bgSubtleClass: "bg-muted/50",
  },
};

const SYMBOL_SUBTITLE: Record<StatusSymbolState, string> = {
  safe: "Eligible (Skips Left)",
  limit_reached: "At 75% Limit (0 Skips)",
  danger: "Below 75% (At Risk)",
  not_started: "No Classes Held",
};

type Theme = "light" | "dim" | "dark";

const THEMES: Theme[] = ["light", "dim", "dark"];

const THEME_SWATCHES: Record<Theme, string> = {
  light: "#faf9f5",
  dim: "#383a41",
  dark: "#141519",
};

const isTheme = (value: string | null): value is Theme =>
  value === "light" || value === "dim" || value === "dark";

const themeStore = {
  subscribe(onStoreChange: () => void): () => void {
    const root = document.documentElement;
    const stored = localStorage.getItem("theme");
    if (isTheme(stored) && root.getAttribute("data-theme") !== stored) {
      root.setAttribute("data-theme", stored);
    }
    const observer = new MutationObserver(onStoreChange);
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  },
  getSnapshot(): Theme {
    const value = document.documentElement.getAttribute("data-theme");
    return isTheme(value) ? value : "light";
  },
  getServerSnapshot(): Theme {
    return "light";
  },
};

export default function DashboardPage() {
  const shouldReduceMotion = useReducedMotion();
  const theme = useSyncExternalStore(
    themeStore.subscribe,
    themeStore.getSnapshot,
    themeStore.getServerSnapshot
  );

  const applyTheme = (next: Theme) => {
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
  };

  const cycleTheme = () => {
    applyTheme(THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length]);
  };

  const [expandedCodes, setExpandedCodes] = useState<ReadonlySet<string>>(
    () => new Set()
  );
  const [report, setReport] = useState<LoadedReport | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const toggleExpanded = (code: string) => {
    setExpandedCodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) {
        next.delete(code);
      } else {
        next.add(code);
      }
      return next;
    });
  };

  const activeCourses = report?.courses ?? MOCK_COURSES;

  const analyzedCourses = activeCourses.map((course) => ({
    course,
    analysis: analyzeCourse(course),
  }));

  const summary = getAttendanceSummary(activeCourses);

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
      const [{ configurePdfWorker }, { parseAttendanceReport }] =
        await Promise.all([
          import("@/lib/pdfWorker"),
          import("@/lib/parseReport"),
        ]);

      await configurePdfWorker();
      const buffer = await file.arrayBuffer();
      const result = await parseAttendanceReport(buffer);

      setReport({ ...result, fileName: file.name });
      setExpandedCodes(new Set());
    } catch (error) {
      // Keep the previously loaded valid report on a failed replacement.
      setUploadError(describeUploadError(error));
    } finally {
      setIsParsing(false);
    }
  };

  const handleClearReport = () => {
    setReport(null);
    setUploadError(null);
    setExpandedCodes(new Set());
  };

  // Stagger animation variants for page load
  const containerVariants = {
    hidden: { opacity: shouldReduceMotion ? 1 : 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: shouldReduceMotion ? 0 : 0.05,
        delayChildren: shouldReduceMotion ? 0 : 0.02,
      },
    },
  };

  const itemVariants = {
    hidden: {
      opacity: shouldReduceMotion ? 1 : 0,
      y: shouldReduceMotion ? 0 : 8,
    },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: shouldReduceMotion ? 0 : 0.28,
        ease: "easeOut" as const,
      },
    },
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
                  <span>{analyzedCourses.length} Courses</span>
                  <span aria-hidden="true">·</span>
                  <span>Exam Limit {HARD_LIMIT}%</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
              <button
                type="button"
                onClick={cycleTheme}
                aria-label={`Theme: ${theme}. Activate to change theme`}
                className="flex items-center gap-2 border border-border px-2 py-1 transition-colors hover:bg-muted focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
              >
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  {theme}
                </span>
                <span className="flex items-center gap-1" aria-hidden="true">
                  {THEMES.map((t) => (
                    <span
                      key={t}
                      className={`block size-2.5 transition-colors ${
                        theme === t
                          ? "border-2 border-foreground"
                          : "border border-border"
                      }`}
                      style={{ backgroundColor: THEME_SWATCHES[t] }}
                    />
                  ))}
                </span>
              </button>

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

        <NedConnection />

        {/* Attendance report source */}
        <section aria-labelledby="upload-heading" className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2
              id="upload-heading"
              className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground"
            >
              Attendance Data
            </h2>
            <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              {report ? "Uploaded report" : "Sample data"}
            </span>
          </div>

          <div className="space-y-3 border border-border bg-card p-3.5 sm:p-4">
            <ReportUpload
              fileName={report?.fileName ?? null}
              isParsing={isParsing}
              onFileSelected={handleFileSelected}
              onClear={handleClearReport}
            />

            {uploadError && (
              <p
                role="alert"
                className="border border-status-danger/40 bg-status-danger/10 p-2 text-xs text-status-danger"
              >
                {uploadError}
              </p>
            )}

            {report && (
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Showing {report.courses.length}{" "}
                {report.courses.length === 1 ? "course" : "courses"} from{" "}
                {report.fileName}. Attendance uses the same calculation rules as
                the sample data.
              </p>
            )}
          </div>
        </section>

        {report && (
          <ParseNotices
            warnings={report.warnings}
            skippedRows={report.skippedRows}
          />
        )}

        {/* Semester Overview — editorial readout band */}
        <section aria-labelledby="summary-heading" className="space-y-3">
          <h2
            id="summary-heading"
            className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground"
          >
            Semester Overview
          </h2>
          <div className="grid grid-cols-1 border border-border bg-card sm:grid-cols-3">
            <div className="border-b border-border p-4 sm:border-b-0 sm:border-r sm:p-5">
              <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                Courses at risk
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span
                  className={`font-bricolage text-3xl font-bold tracking-tight tabular-nums ${
                    summary.coursesAtRiskCount > 0
                      ? "text-status-danger"
                      : "text-foreground"
                  }`}
                >
                  {summary.coursesAtRiskCount}
                </span>
                <span className="text-xs text-muted-foreground">
                  {summary.coursesAtRiskCount === 1 ? "course" : "courses"}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {summary.coursesAtRiskCount > 0
                  ? `Below ${HARD_LIMIT}% exam eligibility threshold`
                  : `All courses maintain ≥${HARD_LIMIT}% eligibility`}
              </p>
            </div>

            <div className="border-b border-border p-4 sm:border-b-0 sm:border-r sm:p-5">
              <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                Lowest attendance
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="font-bricolage text-lg font-bold uppercase tracking-wider text-foreground">
                  {summary.lowestCourse ? summary.lowestCourse.code : "—"}
                </span>
                {summary.lowestCourse?.currentPercent !== null &&
                  summary.lowestCourse?.currentPercent !== undefined && (
                    <span
                      className={`font-bricolage text-2xl font-bold tracking-tight tabular-nums ${
                        STATUS_CONFIG[summary.lowestCourse.status].textClass
                      }`}
                    >
                      {summary.lowestCourse.currentPercent}%
                    </span>
                  )}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {summary.lowestCourse
                  ? summary.lowestCourse.status === "danger"
                    ? `Danger (below ${HARD_LIMIT}% exam limit)`
                    : summary.lowestCourse.hardSkips === 0
                    ? `At ${HARD_LIMIT}% limit (0 skips left)`
                    : `Eligible (${summary.lowestCourse.hardSkips} skips left)`
                  : "No active courses"}
              </p>
            </div>

            <div className="p-4 sm:p-5">
              <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                Highest attendance
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="font-bricolage text-lg font-bold uppercase tracking-wider text-foreground">
                  {summary.safestCourse ? summary.safestCourse.code : "—"}
                </span>
                {summary.safestCourse?.currentPercent !== null &&
                  summary.safestCourse?.currentPercent !== undefined && (
                    <span className="font-bricolage text-2xl font-bold tracking-tight text-status-safe tabular-nums">
                      {summary.safestCourse.currentPercent}%
                    </span>
                  )}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {summary.safestCourse
                  ? `${summary.safestCourse.hardSkips} skips left before reaching ${HARD_LIMIT}%`
                  : "No active courses"}
              </p>
            </div>
          </div>
        </section>

        {/* Course Grid — responsive compact course boxes */}
        <section aria-labelledby="courses-heading" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2
              id="courses-heading"
              className="text-base font-semibold tracking-tight text-foreground sm:text-lg"
            >
              Courses ({analyzedCourses.length})
            </h2>
            <span className="text-[11px] text-muted-foreground">
              Exam limit: {HARD_LIMIT}%
            </span>
          </div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2 lg:grid-cols-3"
          >
            {analyzedCourses.map(({ course, analysis }) => {
              const statusCfg = STATUS_CONFIG[analysis.status];
              const symbolState = getStatusSymbolState(
                analysis.status,
                analysis.hardSkips
              );
              const hasStarted =
                analysis.status !== "not_started" &&
                analysis.currentPercent !== null;
              const percentValue = hasStarted
                ? analysis.currentPercent ?? 0
                : null;
              const creditText =
                course.prCredits > 0
                  ? `${course.thCredits} Th + ${course.prCredits} Pr`
                  : `${course.thCredits} Th`;
              const expanded = expandedCodes.has(analysis.code);
              const panelId = `course-panel-${analysis.code}`;

              // Primary collapsed readout: Skips left (at 75% limit)
              const skipsLeftDisplay = hasStarted
                ? `${analysis.hardSkips}`
                : "—";

              return (
                <motion.div
                  key={course.code}
                  variants={itemVariants}
                  className="flex flex-col border border-border bg-card transition-colors hover:border-foreground/30"
                >
                  {/* Collapsed view & Interactive toggle header */}
                  <button
                    type="button"
                    onClick={() => toggleExpanded(analysis.code)}
                    aria-expanded={expanded}
                    aria-controls={panelId}
                    className="flex w-full flex-col p-4 text-left focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    {/* Header line: Course Code, Credits, and Expand Indicator */}
                    <div className="flex w-full items-baseline justify-between gap-2 border-b border-border/60 pb-2.5">
                      <div className="flex min-w-0 items-baseline gap-2">
                        <span className="truncate font-bricolage text-lg font-bold uppercase tracking-wider text-foreground">
                          {analysis.code}
                        </span>
                        <span className="truncate text-[11px] text-muted-foreground">
                          {creditText}
                        </span>
                      </div>
                      <span
                        aria-hidden="true"
                        className="font-mono shrink-0 text-xs text-muted-foreground"
                      >
                        {expanded ? "−" : "+"}
                      </span>
                    </div>

                    {/* Primary Collapsed Readout: Skips Left */}
                    <div className="mt-3.5 flex items-end justify-between gap-3">
                      <div>
                        <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                          Skips Left
                        </div>
                        <div className="mt-1 flex items-baseline gap-1.5">
                          <span
                            className={`font-bricolage text-[40px] leading-none font-bold tracking-tight tabular-nums sm:text-[44px] ${
                              hasStarted && analysis.hardSkips === 0
                                ? analysis.status === "danger"
                                  ? "text-status-danger"
                                  : "text-status-warning"
                                : "text-foreground"
                            }`}
                          >
                            {skipsLeftDisplay}
                          </span>
                          {hasStarted && (
                            <span className="text-xs text-muted-foreground">
                              to stay ≥{HARD_LIMIT}%
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Swiss editorial status badge with geometric mark */}
                      <div className="flex flex-col items-end text-right">
                        <div className="flex items-center gap-1.5">
                          <StatusSymbol
                            state={symbolState}
                            className={`size-3.5 shrink-0 ${statusCfg.textClass}`}
                          />
                          <span
                            className={`text-xs font-semibold uppercase tracking-wider ${statusCfg.textClass}`}
                          >
                            {statusCfg.label}
                          </span>
                        </div>
                        <span className="mt-1 text-[10px] text-muted-foreground">
                          {SYMBOL_SUBTITLE[symbolState]}
                        </span>
                      </div>
                    </div>
                  </button>

                  {/* Expanded View with Smooth Drawer Animation */}
                  <AnimatePresence initial={false}>
                    {expanded && (
                      <motion.div
                        id={panelId}
                        key={panelId}
                        initial={
                          shouldReduceMotion
                            ? { opacity: 1 }
                            : { height: 0, opacity: 0 }
                        }
                        animate={
                          shouldReduceMotion
                            ? { opacity: 1 }
                            : { height: "auto", opacity: 1 }
                        }
                        exit={
                          shouldReduceMotion
                            ? { opacity: 0 }
                            : { height: 0, opacity: 0 }
                        }
                        transition={{
                          duration: shouldReduceMotion ? 0 : 0.24,
                          ease: [0.16, 1, 0.3, 1],
                        }}
                        className="overflow-hidden border-t border-border"
                      >
                        <div className="px-3 pb-3 sm:px-4 sm:pb-4">
                          <div className="mt-3 space-y-3 border border-border/70 bg-muted/40 p-3">
                            {/* Expanded Readout: Course Code + Attendance Percentage & Class counts */}
                            <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-2 border-b border-border/60 pb-2.5">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bricolage text-sm font-bold uppercase tracking-wider text-foreground">
                                    {analysis.code}
                                  </span>
                                  <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                                    Current Attendance
                                  </span>
                                </div>
                                <div
                                  className={`font-bricolage mt-1 text-[28px] leading-none font-bold tracking-tight tabular-nums sm:text-[32px] ${
                                    hasStarted
                                      ? statusCfg.textClass
                                      : "text-muted-foreground"
                                  }`}
                                >
                                  {hasStarted ? `${percentValue}%` : "--%"}
                                </div>
                              </div>
                              <div className="text-right text-[11px] text-muted-foreground">
                                {hasStarted
                                  ? course.prCredits > 0
                                    ? `Theory: ${course.thPresent}/${course.thHeld} · Lab: ${course.prPresent}/${course.prHeld}`
                                    : `Theory: ${course.thPresent}/${course.thHeld}`
                                  : "0/0 classes held"}
                              </div>
                            </div>

                            {/* Attendance Scale Bar */}
                            <AttendanceScale
                              code={analysis.code}
                              percent={percentValue}
                              status={analysis.status}
                            />
                          </div>

                          {/* Theory / Practical Detailed Breakdown */}
                          <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                            <div className="border border-border bg-muted/50 p-2 text-left">
                              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                                Theory
                              </div>
                              <div className="mt-0.5 text-xs font-medium text-foreground">
                                {course.thPresent} / {course.thHeld} held
                              </div>
                              <div className="mt-0.5 text-[10px] text-muted-foreground">
                                Planned:{" "}
                                {course.thPlanned ??
                                  course.thCredits * WEEKS_PER_SEMESTER}
                              </div>
                            </div>
                            <div className="border border-border bg-muted/50 p-2 text-left">
                              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                                Practical
                              </div>
                              <div className="mt-0.5 text-xs font-medium text-foreground">
                                {course.prCredits > 0
                                  ? `${course.prPresent} / ${course.prHeld} held`
                                  : "None"}
                              </div>
                              <div className="mt-0.5 text-[10px] text-muted-foreground">
                                {course.prCredits > 0
                                  ? `${course.prCredits} Lab Credit`
                                  : "Theory only"}
                              </div>
                            </div>
                          </div>

                          {/* Skips Allowance Detail */}
                          <div className="mt-2 border border-border bg-muted/50 p-2 text-[11px]">
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">
                                Absences allowed before falling below {HARD_LIMIT}%:
                              </span>
                              <span className="font-bricolage font-semibold text-foreground tabular-nums">
                                {analysis.hardSkips} {analysis.hardSkips === 1 ? "skip" : "skips"} left
                              </span>
                            </div>
                          </div>

                          {/* Contextual Guidance */}
                          {analysis.status === "danger" && (
                            <div className="mt-2 border border-status-danger/40 bg-status-danger/10 p-2 text-xs text-status-danger">
                              <p className="font-medium leading-relaxed">
                                Attendance is below {HARD_LIMIT}%. Attend every remaining class to recover. You can miss 0 more classes.
                              </p>
                            </div>
                          )}
                          {analysis.status === "warning" && analysis.hardSkips === 0 && (
                            <div className="mt-2 border border-status-warning/40 bg-status-warning/10 p-2 text-xs text-status-warning">
                              <p className="font-medium leading-relaxed">
                                Exactly at the {HARD_LIMIT}% exam eligibility limit. Any further absence will result in exam ineligibility.
                              </p>
                            </div>
                          )}
                          {analysis.status === "not_started" && (
                            <div className="mt-2 border border-border bg-muted/50 p-2 text-xs text-muted-foreground">
                              <span>
                                No classes have been recorded yet for this course.
                              </span>
                            </div>
                          )}

                          <p className="mt-2 text-[10px] leading-tight text-muted-foreground">
                            Calculated per {WEEKS_PER_SEMESTER}-week curriculum rules.
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </motion.div>
        </section>

        {/* Disclaimer Note */}
        <footer className="border border-border bg-card p-3.5 text-center text-xs text-muted-foreground shadow-none sm:p-4">
          <div className="flex items-center justify-center gap-2">
            <Info className="size-4 shrink-0" />
            <p>
              Estimates based on a {WEEKS_PER_SEMESTER}-teaching-week semester. The official university record decides eligibility.
            </p>
          </div>
        </footer>
      </div>
    </main>
  );
}
