"use client";

import { useSyncExternalStore, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { MOCK_COURSES } from "@/lib/mockCourses";
import {
  analyzeCourse,
  getAttendanceSummary,
  WEEKS_PER_SEMESTER,
  HARD_LIMIT,
  SAFE_LIMIT,
  type Status,
} from "@/lib/attendance";
import { Button } from "@/components/ui/button";
import { SSMonogram } from "@/components/SSMonogram";
import { AttendanceScale } from "@/components/AttendanceScale";
import { PixelStatusSymbol } from "@/components/PixelStatusSymbol";
import { Info } from "lucide-react";

const STATUS_CONFIG: Record<
  Status,
  {
    label: string;
    badgeClass: string;
    textClass: string;
  }
> = {
  safe: {
    label: "Safe",
    badgeClass:
      "rounded-none border border-status-safe/40 bg-status-safe/10 font-medium text-status-safe",
    textClass: "text-status-safe",
  },
  warning: {
    label: "Warning",
    badgeClass:
      "rounded-none border border-status-warning/40 bg-status-warning/10 font-medium text-status-warning",
    textClass: "text-status-warning",
  },
  danger: {
    label: "Danger",
    badgeClass:
      "rounded-none border border-status-danger/40 bg-status-danger/10 font-medium text-status-danger",
    textClass: "text-status-danger",
  },
  not_started: {
    label: "Not started",
    badgeClass:
      "rounded-none border border-border bg-muted font-medium text-muted-foreground",
    textClass: "text-muted-foreground",
  },
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

  const analyzedCourses = MOCK_COURSES.map((course) => ({
    course,
    analysis: analyzeCourse(course),
  }));

  const summary = getAttendanceSummary(MOCK_COURSES);

  // Stagger animation variants
  const containerVariants = {
    hidden: { opacity: shouldReduceMotion ? 1 : 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: shouldReduceMotion ? 0 : 0.07,
        delayChildren: shouldReduceMotion ? 0 : 0.04,
      },
    },
  };

  const itemVariants = {
    hidden: {
      opacity: shouldReduceMotion ? 1 : 0,
      y: shouldReduceMotion ? 0 : 10,
    },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: shouldReduceMotion ? 0 : 0.32,
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
          <h1 className="font-bricolage text-xl leading-none font-bold text-foreground">
            SkipSafe
          </h1>
        </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  <span>{WEEKS_PER_SEMESTER} Teaching Weeks</span>
                  <span aria-hidden="true">·</span>
                  <span>{analyzedCourses.length} Courses</span>
                  <span aria-hidden="true">·</span>
                  <span>Exam Limit {HARD_LIMIT}%</span>
                  <span aria-hidden="true">·</span>
                  <span>Cushion {SAFE_LIMIT}%</span>
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
                  className={`font-bricolage text-3xl font-semibold tracking-tight ${
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
                  ? `Below ${HARD_LIMIT}% exam threshold`
                  : summary.warningCount > 0
                  ? `${summary.warningCount} course on warning (<${SAFE_LIMIT}% cushion)`
                  : `All courses above ${SAFE_LIMIT}% cushion`}
              </p>
            </div>

            <div className="border-b border-border p-4 sm:border-b-0 sm:border-r sm:p-5">
              <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                Lowest attendance
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="font-bricolage text-2xl font-semibold tracking-tight text-foreground">
                  {summary.lowestCourse ? summary.lowestCourse.code : "—"}
                </span>
                {summary.lowestCourse?.currentPercent !== null &&
                  summary.lowestCourse?.currentPercent !== undefined && (
                    <span
                      className={`font-bricolage text-lg font-semibold ${
                        STATUS_CONFIG[summary.lowestCourse.status].textClass
                      }`}
                    >
                      {summary.lowestCourse.currentPercent}%
                    </span>
                  )}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {summary.lowestCourse
                  ? summary.lowestCourse.status === "warning"
                    ? `Warning (below ${SAFE_LIMIT}% safe cushion)`
                    : summary.lowestCourse.status === "danger"
                    ? `Danger (below ${HARD_LIMIT}% exam limit)`
                    : `Safe (≥${SAFE_LIMIT}% cushion)`
                  : "No active courses"}
              </p>
            </div>

            <div className="p-4 sm:p-5">
              <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                Safest course
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="font-bricolage text-2xl font-semibold tracking-tight text-foreground">
                  {summary.safestCourse ? summary.safestCourse.code : "—"}
                </span>
                {summary.safestCourse?.currentPercent !== null &&
                  summary.safestCourse?.currentPercent !== undefined && (
                    <span className="font-bricolage text-lg font-semibold text-status-safe">
                      {summary.safestCourse.currentPercent}%
                    </span>
                  )}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {summary.safestCourse
                  ? `Highest cushion (${summary.safestCourse.safeSkips} safe skips left)`
                  : "No active courses"}
              </p>
            </div>
          </div>
        </section>

        {/* Course Panels — instrument rows */}
        <section aria-labelledby="courses-heading" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2
              id="courses-heading"
              className="text-base font-semibold tracking-tight text-foreground sm:text-lg"
            >
              Courses ({analyzedCourses.length})
            </h2>
            <span className="text-[11px] text-muted-foreground">
              Exam limit: {HARD_LIMIT}% • Cushion: {SAFE_LIMIT}%
            </span>
          </div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="border border-border bg-card"
          >
            {analyzedCourses.map(({ course, analysis }, index) => {
              const statusCfg = STATUS_CONFIG[analysis.status];
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

              return (
                <motion.div
                  key={course.code}
                  variants={itemVariants}
                  className={index > 0 ? "border-t border-border" : ""}
                >
                  <button
                    type="button"
                    onClick={() => toggleExpanded(analysis.code)}
                    aria-expanded={expanded}
                    aria-controls={panelId}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none sm:px-5"
                  >
                    <span className="flex min-w-0 items-baseline gap-2">
                      <span className="truncate text-sm font-semibold uppercase tracking-wide text-foreground">
                        {analysis.code}
                      </span>
                      <span className="truncate text-[11px] text-muted-foreground">
                        {creditText}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <PixelStatusSymbol
                        status={analysis.status}
                        className={`size-3 ${statusCfg.textClass}`}
                      />
                      <span
                        className={`text-[11px] font-medium uppercase tracking-wider ${statusCfg.textClass}`}
                      >
                        {statusCfg.label}
                      </span>
                      <span
                        aria-hidden="true"
                        className="font-pixel ml-1 text-sm text-muted-foreground"
                      >
                        {expanded ? "-" : "+"}
                      </span>
                    </span>
                  </button>

                  <div id={panelId} hidden={!expanded}>
                    <div className="border-t border-border px-3 pb-3 sm:px-4 sm:pb-4">
                      <div className="mt-3 space-y-3 border border-border/70 bg-muted/40 p-3 sm:p-4">

                      {/* Screen readout */}
                      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
                        <div>
                          <div
                            className={`font-pixel text-4xl leading-none sm:text-5xl ${
                              hasStarted
                                ? statusCfg.textClass
                                : "text-muted-foreground"
                            }`}
                          >
                            {hasStarted ? `${percentValue}%` : "--%"}
                          </div>
                          <div className="mt-2 text-[11px] text-muted-foreground">
                            {hasStarted
                              ? course.prCredits > 0
                                ? `Theory: ${course.thPresent}/${course.thHeld} · Practical: ${course.prPresent}/${course.prHeld}`
                                : `Theory: ${course.thPresent}/${course.thHeld} held`
                              : "0/0 classes held so far"}
                          </div>
                        </div>
                        {hasStarted && (
                          <div className="flex items-end gap-5 sm:gap-7">
                            <div className="text-right">
                              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                                Safe
                              </div>
                              <div className="font-pixel text-2xl leading-none text-status-safe">
                                {analysis.safeSkips}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                                Limit
                              </div>
                              <div className="font-pixel text-2xl leading-none text-foreground">
                                {analysis.hardSkips}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      <AttendanceScale
                        code={analysis.code}
                        percent={percentValue}
                        status={analysis.status}
                      />
                    </div>

                    {/* Inline course details */}
                    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <div className="border border-border bg-muted/50 p-2.5">
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          Theory Classes
                        </div>
                        <div className="mt-0.5 text-sm font-medium text-foreground">
                          {course.thPresent} / {course.thHeld} held
                        </div>
                        <div className="mt-0.5 text-[10px] text-muted-foreground">
                          Planned:{" "}
                          {course.thPlanned ??
                            course.thCredits * WEEKS_PER_SEMESTER}
                        </div>
                      </div>
                      <div className="border border-border bg-muted/50 p-2.5">
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          Practical Sessions
                        </div>
                        <div className="mt-0.5 text-sm font-medium text-foreground">
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

                    <div className="mt-2 space-y-1.5 border border-border bg-muted/50 p-2.5 text-[11px]">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">
                          Safe Cushion Target ({SAFE_LIMIT}%):
                        </span>
                        <span className="font-medium text-status-safe">
                          {analysis.safeSkips} skips left
                        </span>
                      </div>
                      <div className="flex items-center justify-between border-t border-border pt-1.5">
                        <span className="text-muted-foreground">
                          Exam Eligibility Limit ({HARD_LIMIT}%):
                        </span>
                        <span className="font-medium text-foreground">
                          {analysis.hardSkips} skips left
                        </span>
                      </div>
                    </div>

                    {analysis.status === "danger" && (
                      <div className="mt-2 border border-status-danger/40 bg-status-danger/10 p-2.5 text-xs text-status-danger">
                        <p className="font-medium leading-relaxed">
                          Attend every remaining class to recover. You can miss
                          at most{" "}
                          <span className="font-medium">
                            {analysis.hardSkips}
                          </span>{" "}
                          more.
                        </p>
                      </div>
                    )}
                    {analysis.status === "not_started" && (
                      <div className="mt-2 border border-border bg-muted/50 p-2.5 text-xs text-muted-foreground">
                        <span>
                          No classes have been recorded yet for this course.
                        </span>
                      </div>
                    )}

                    <p className="mt-2 text-[10px] leading-tight text-muted-foreground">
                      Calculated per {WEEKS_PER_SEMESTER}-teaching-week curriculum rules
                      (16 calendar weeks minus midterm).
                    </p>
                  </div>
                </div>

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
