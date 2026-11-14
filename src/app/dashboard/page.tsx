"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  analyzeCourse,
  getAttendanceSummary,
  WEEKS_PER_SEMESTER,
  HARD_LIMIT,
  type Status,
} from "@/lib/attendance";
import {
  getCourseCardDisplay,
  sortCoursesByRisk,
} from "@/lib/courseCardDisplay";
import { Button } from "@/components/ui/button";
import { SSMonogram } from "@/components/SSMonogram";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AttendanceScale } from "@/components/AttendanceScale";
import { ParseNotices } from "@/components/ParseNotices";
import { ReportUpload } from "@/components/ReportUpload";
import {
  StatusSymbol,
  getStatusSymbolState,
  type StatusSymbolState,
} from "@/components/StatusSymbol";
import { Info, KeyRound } from "lucide-react";
import {
  useReport,
  parseAndStoreReport,
  describeUploadError,
} from "@/lib/reportStore";

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

export default function DashboardPage() {
  const shouldReduceMotion = useReducedMotion();
  const [report, setReport] = useReport();
  const [expandedCodes, setExpandedCodes] = useState<ReadonlySet<string>>(
    () => new Set()
  );
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

  const handleClearReport = () => {
    setReport(null);
    setUploadError(null);
    setExpandedCodes(new Set());
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
      setExpandedCodes(new Set());
    } catch (error) {
      setUploadError(describeUploadError(error));
    } finally {
      setIsParsing(false);
    }
  };

  const analyzedCourses = report
    ? sortCoursesByRisk(
        report.courses.map((course) => ({
          course,
          analysis: analyzeCourse(course),
        }))
      )
    : [];

  const summary = report ? getAttendanceSummary(report.courses) : null;

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
                  {report && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>{analyzedCourses.length} Courses</span>
                    </>
                  )}
                  <span aria-hidden="true">·</span>
                  <span>Exam Limit {HARD_LIMIT}%</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
              <ThemeToggle />

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

        {!report ? (
          /* Empty state when no report is loaded */
          <section aria-labelledby="empty-heading" className="space-y-4">
            <div className="border border-border bg-card p-6 sm:p-8 space-y-5">
              <div className="space-y-1.5">
                <h2
                  id="empty-heading"
                  className="font-bricolage text-lg font-bold tracking-tight text-foreground sm:text-xl"
                >
                  No Attendance Report Loaded
                </h2>
                <p className="text-xs leading-relaxed text-muted-foreground sm:text-sm max-w-xl">
                  Connect your NED student portal account to retrieve your
                  attendance, or upload your Course-Wise Attendance Analysis PDF
                  manually below. SkipSafe computes your skip allowance and exam
                  eligibility entirely in your browser.
                </p>
              </div>

              <div className="pt-1 flex flex-wrap items-center gap-3">
                <Link
                  href="/connect"
                  className="inline-flex h-9 items-center justify-center bg-primary px-4 text-xs font-medium text-primary-foreground shadow-none hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <KeyRound className="size-3.5 mr-1.5" />
                  Connect to NED
                </Link>
              </div>

              <div className="border-t border-border/60 pt-4 space-y-3">
                <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground font-semibold">
                  Or upload PDF manually
                </div>
                <ReportUpload
                  fileName={null}
                  isParsing={isParsing}
                  onFileSelected={handleFileSelected}
                  onClear={handleClearReport}
                />
                {uploadError && (
                  <p
                    role="alert"
                    className="border border-status-danger/40 bg-status-danger/10 p-2 text-xs text-status-danger text-left"
                  >
                    {uploadError}
                  </p>
                )}
              </div>
            </div>
          </section>
        ) : (
          <>
            {/* Attendance report source */}
            <section aria-labelledby="upload-heading" className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h2
                  id="upload-heading"
                  className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground"
                >
                  Attendance Data
                </h2>
                <div className="flex items-center gap-3">
                  <Link
                    href="/connect"
                    className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground underline underline-offset-2"
                  >
                    Connect account
                  </Link>
                  <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                    Uploaded report
                  </span>
                </div>
              </div>

              <div className="space-y-3 border border-border bg-card p-3.5 sm:p-4">
                <ReportUpload
                  fileName={report.fileName}
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

                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  Showing {report.courses.length}{" "}
                  {report.courses.length === 1 ? "course" : "courses"} from{" "}
                  {report.fileName}. Attendance uses the official NED calculation
                  rules.
                </p>
              </div>
            </section>

            <ParseNotices
              warnings={report.warnings}
              skippedRows={report.skippedRows}
            />

            {/* Semester Overview — editorial readout band */}
            {summary && (
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
            )}

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
                  const cardDisplay = getCourseCardDisplay(course, analysis);

                  const thPlanned =
                    course.thPlanned ??
                    course.thCredits * WEEKS_PER_SEMESTER;
                  const prPlanned = course.prPlanned ?? course.prHeld;

                  return (
                    <motion.div
                      key={course.code}
                      variants={itemVariants}
                      className="flex flex-col border border-border bg-card transition-colors hover:border-foreground/30"
                    >
                      {/* Box Header Strip */}
                      <button
                        type="button"
                        onClick={() => toggleExpanded(analysis.code)}
                        aria-expanded={expanded}
                        aria-controls={panelId}
                        className="flex w-full items-center justify-between border-b border-border bg-muted/40 px-3.5 py-2.5 text-left transition-colors hover:bg-muted/70 focus-visible:bg-muted/70 focus-visible:outline-none"
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="font-bricolage text-sm font-bold tracking-wider text-foreground">
                            {course.code}
                          </span>
                          <span
                            className="text-xs text-muted-foreground"
                            aria-hidden="true"
                          >
                            ·
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {creditText}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`flex items-center gap-1 text-[11px] font-medium ${statusCfg.textClass}`}
                          >
                            <StatusSymbol state={symbolState} />
                            <span>{statusCfg.label}</span>
                          </span>
                          <span
                            aria-hidden="true"
                            className="font-mono text-xs text-muted-foreground"
                          >
                            {expanded ? "[-]" : "[+]"}
                          </span>
                        </div>
                      </button>

                      {/* Course Title */}
                      <div className="px-3.5 pt-3">
                        <h3 className="line-clamp-1 font-bricolage text-lg font-bold tracking-tight text-foreground">
                          {course.code}
                        </h3>
                      </div>

                      {/* Primary Collapsed Readout: Skips Left or Danger Guidance */}
                      <div className="p-3.5">
                        <div className="border border-border bg-background p-3 text-center">
                          {cardDisplay.kind !== "normal" ? (
                            <div className="flex min-h-[64px] flex-col items-center justify-center py-1 px-1">
                              <p className="text-xs font-semibold leading-relaxed text-status-danger">
                                {cardDisplay.message}
                              </p>
                            </div>
                          ) : (
                            <>
                              <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                                Skips left
                              </div>
                              <div className="mt-1 flex items-baseline justify-center gap-1.5">
                                <span
                                  className={`font-bricolage text-[40px] font-bold leading-none tracking-tight tabular-nums sm:text-[44px] ${
                                    analysis.hardSkips === 0
                                      ? "text-status-warning"
                                      : "text-foreground"
                                  }`}
                                >
                                  {cardDisplay.displayValue}
                                </span>
                                {hasStarted && (
                                  <span className="text-xs text-muted-foreground">
                                    {analysis.hardSkips === 1 ? "class" : "classes"}
                                  </span>
                                )}
                              </div>
                              <div className="mt-1 text-[10px] text-muted-foreground">
                                {SYMBOL_SUBTITLE[symbolState]}
                              </div>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Inline Expanded Drawer */}
                      <AnimatePresence initial={false}>
                        {expanded && (
                          <motion.div
                            id={panelId}
                            initial={{ height: 0, opacity: 0 }}
                            animate={{
                              height: "auto",
                              opacity: 1,
                              transition: {
                                height: {
                                  duration: shouldReduceMotion ? 0 : 0.28,
                                  ease: [0.16, 1, 0.3, 1],
                                },
                                opacity: {
                                  duration: shouldReduceMotion ? 0 : 0.05,
                                },
                              },
                            }}
                            exit={{
                              height: 0,
                              opacity: 0,
                              transition: {
                                height: {
                                  duration: shouldReduceMotion ? 0 : 0.22,
                                  ease: [0.16, 1, 0.3, 1],
                                },
                                opacity: {
                                  duration: shouldReduceMotion ? 0 : 0.15,
                                },
                              },
                            }}
                            className="overflow-hidden border-t border-border bg-muted/20"
                          >
                            <div className="p-3.5 space-y-3.5">
                              {/* Expanded Attendance Details */}
                              <div className="border border-border bg-background p-3 space-y-3">
                                <div className="flex items-baseline justify-between">
                                  <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                                    Attendance
                                  </span>
                                  {percentValue !== null ? (
                                    <span
                                      className={`font-bricolage text-[28px] font-bold leading-none tracking-tight tabular-nums sm:text-[32px] ${statusCfg.textClass}`}
                                    >
                                      {percentValue}%
                                    </span>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">
                                      Not started
                                    </span>
                                  )}
                                </div>

                                <AttendanceScale
                                  code={course.code}
                                  percent={percentValue}
                                  status={analysis.status}
                                />

                                <div className="grid grid-cols-2 gap-2 border-t border-border/60 pt-2 text-[11px]">
                                  <div>
                                    <span className="text-muted-foreground">
                                      Theory:
                                    </span>{" "}
                                    <span className="font-medium text-foreground">
                                      {course.thPresent}/{course.thHeld}
                                    </span>
                                  </div>
                                  {course.prCredits > 0 && (
                                    <div>
                                      <span className="text-muted-foreground">
                                        Practical:
                                      </span>{" "}
                                      <span className="font-medium text-foreground">
                                        {course.prPresent}/{course.prHeld}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Projected skips breakdown */}
                              <div className="space-y-1.5 text-xs">
                                <div className="flex items-center justify-between border-b border-border/60 pb-1">
                                  <span className="text-muted-foreground">
                                    Planned classes:
                                  </span>
                                  <span className="font-medium text-foreground">
                                    {thPlanned} theory
                                    {prPlanned > 0 ? ` + ${prPlanned} practical` : ""}
                                  </span>
                                </div>
                                {cardDisplay.kind !== "danger_unrecoverable" && (
                                  <div className="flex items-center justify-between border-b border-border/60 pb-1">
                                    <span className="text-muted-foreground">
                                      75% hard limit:
                                    </span>
                                    <span
                                      className={`font-medium ${
                                        analysis.hardSkips === 0
                                          ? "text-status-warning"
                                          : "text-foreground"
                                      }`}
                                    >
                                      {analysis.hardSkips}{" "}
                                      {analysis.hardSkips === 1 ? "skip" : "skips"}{" "}
                                      left
                                    </span>
                                  </div>
                                )}
                              </div>

                              {/* Contextual Guidance */}
                              {cardDisplay.kind !== "normal" && (
                                <div className="mt-2 border border-status-danger/40 bg-status-danger/10 p-2 text-xs text-status-danger">
                                  <p className="font-medium leading-relaxed">
                                    {cardDisplay.message}
                                  </p>
                                </div>
                              )}
                              {analysis.status === "warning" &&
                                analysis.hardSkips === 0 && (
                                  <div className="mt-2 border border-status-warning/40 bg-status-warning/10 p-2 text-xs text-status-warning">
                                    <p className="font-medium leading-relaxed">
                                      Exactly at the {HARD_LIMIT}% exam
                                      eligibility limit. Any further absence will
                                      result in exam ineligibility.
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
                                Calculated per {WEEKS_PER_SEMESTER}-week curriculum
                                rules.
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
          </>
        )}

        {/* Disclaimer Note */}
        <footer className="border border-border bg-card p-3.5 text-center text-xs text-muted-foreground shadow-none sm:p-4">
          <div className="flex items-center justify-center gap-2">
            <Info className="size-4 shrink-0" />
            <p>
              Estimates based on a {WEEKS_PER_SEMESTER}-teaching-week semester. The
              official university record decides eligibility.
            </p>
          </div>
        </footer>
      </div>
    </main>
  );
}
