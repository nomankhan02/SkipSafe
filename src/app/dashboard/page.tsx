"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { MOCK_COURSES } from "@/lib/mockCourses";
import {
  analyzeCourse,
  getAttendanceSummary,
  type Status,
} from "@/lib/attendance";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ShieldCheck,
  AlertTriangle,
  AlertOctagon,
  Clock,
  Sparkles,
  Info,
} from "lucide-react";

/**
 * Animated number counter that runs once on mount.
 * Strictly respects prefers-reduced-motion and SSR hydration.
 */
function CountUp({
  value,
  decimals,
  suffix = "",
  duration = 0.75,
}: {
  value: number;
  decimals?: number;
  suffix?: string;
  duration?: number;
}) {
  const shouldReduceMotion = useReducedMotion();
  const precision =
    decimals ?? (value.toString().split(".")[1]?.length || 0);

  const [count, setCount] = useState(value);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (shouldReduceMotion) {
      setCount(value);
      return;
    }

    setCount(0);
    const startTime = performance.now();
    let frameId: number;

    const animate = (currentTime: number) => {
      const elapsed = (currentTime - startTime) / 1000;
      const progress = Math.min(elapsed / duration, 1);
      // easeOutExpo
      const ease = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      const current = ease * value;
      setCount(current);

      if (progress < 1) {
        frameId = requestAnimationFrame(animate);
      } else {
        setCount(value);
      }
    };

    frameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameId);
  }, [value, duration, shouldReduceMotion]);

  const display = mounted && !shouldReduceMotion ? count : value;

  return (
    <span>
      {display.toFixed(precision)}
      {suffix}
    </span>
  );
}

const STATUS_CONFIG: Record<
  Status,
  {
    label: string;
    badgeClass: string;
    barColor: string;
    icon: typeof ShieldCheck;
  }
> = {
  safe: {
    label: "Safe",
    badgeClass: "border-emerald-500/30 bg-emerald-950/40 text-emerald-400",
    barColor: "bg-emerald-500",
    icon: ShieldCheck,
  },
  warning: {
    label: "Warning",
    badgeClass: "border-amber-500/30 bg-amber-950/40 text-amber-400",
    barColor: "bg-amber-500",
    icon: AlertTriangle,
  },
  danger: {
    label: "Danger",
    badgeClass: "border-rose-500/30 bg-rose-950/40 text-rose-400",
    barColor: "bg-rose-500",
    icon: AlertOctagon,
  },
  not_started: {
    label: "Not started",
    badgeClass: "border-zinc-800 bg-zinc-900/60 text-zinc-400",
    barColor: "bg-transparent",
    icon: Clock,
  },
};

export default function DashboardPage() {
  const shouldReduceMotion = useReducedMotion();

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
        staggerChildren: shouldReduceMotion ? 0 : 0.08,
        delayChildren: shouldReduceMotion ? 0 : 0.05,
      },
    },
  };

  const itemVariants = {
    hidden: {
      opacity: shouldReduceMotion ? 1 : 0,
      y: shouldReduceMotion ? 0 : 12,
    },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: shouldReduceMotion ? 0 : 0.35,
        ease: "easeOut" as const,
      },
    },
  };

  return (
    <main className="min-h-screen bg-[#070b12] text-zinc-100 antialiased selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* Background subtle mesh glow (no purple) */}
      <div
        className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(16,185,129,0.07),transparent_70%)]"
        aria-hidden="true"
      />

      <div className="relative z-10 mx-auto max-w-5xl px-4 py-5 sm:px-6 sm:py-8 space-y-7">
        {/* Mobile-first Header */}
        <header className="flex flex-col gap-3.5 border-b border-zinc-800/80 pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="inline-block size-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)]" />
              <h1 className="text-2xl font-bold tracking-tight text-zinc-100 sm:text-3xl">
                SkipSafe
              </h1>
            </div>
            <p className="mt-1 text-xs text-zinc-400 sm:text-sm">
              Attendance tracker • Real limit: 75% • Safe cushion: 80%
            </p>
          </div>

          <div className="flex items-center gap-2.5 self-start sm:self-auto">
            {/* “Ask SkipSafe” button that does nothing yet */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {}}
              className="border-zinc-800 bg-zinc-900/90 text-zinc-200 hover:bg-zinc-800/80 hover:text-zinc-50 hover:border-emerald-500/40 shadow-sm transition-all text-xs font-medium gap-1.5 h-8 px-3 rounded-lg"
            >
              <Sparkles className="size-3.5 text-emerald-400 shrink-0" />
              <span>Ask SkipSafe</span>
            </Button>

            <Badge
              variant="outline"
              className="border-zinc-800/80 bg-zinc-900/50 text-[11px] text-zinc-400 px-2 py-0.5 rounded-md"
            >
              16-Week Semester
            </Badge>
          </div>
        </header>

        {/* Summary Row */}
        <section aria-labelledby="summary-heading" className="space-y-3">
          <h2
            id="summary-heading"
            className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400"
          >
            Semester Overview
          </h2>
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4"
          >
            {/* Courses at risk */}
            <motion.div variants={itemVariants}>
              <Card className="border-zinc-800/80 bg-zinc-900/60 p-4 sm:p-5 shadow-sm backdrop-blur-sm hover:border-zinc-700/80 transition-colors">
                <CardHeader className="p-0 pb-1.5">
                  <CardTitle className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                    Courses at risk
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0 space-y-1">
                  <div className="flex items-baseline gap-2">
                    <span
                      className={`text-3xl font-bold tracking-tight font-mono ${
                        summary.coursesAtRiskCount > 0
                          ? "text-rose-400"
                          : "text-zinc-100"
                      }`}
                    >
                      <CountUp value={summary.coursesAtRiskCount} decimals={0} />
                    </span>
                    <span className="text-xs text-zinc-400">
                      {summary.coursesAtRiskCount === 1 ? "course" : "courses"}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400">
                    {summary.coursesAtRiskCount > 0
                      ? "Below 75% exam threshold"
                      : summary.warningCount > 0
                      ? `${summary.warningCount} course on warning (<80% cushion)`
                      : "All courses above 80% cushion"}
                  </p>
                </CardContent>
              </Card>
            </motion.div>

            {/* Lowest attendance */}
            <motion.div variants={itemVariants}>
              <Card className="border-zinc-800/80 bg-zinc-900/60 p-4 sm:p-5 shadow-sm backdrop-blur-sm hover:border-zinc-700/80 transition-colors">
                <CardHeader className="p-0 pb-1.5">
                  <CardTitle className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                    Lowest attendance
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0 space-y-1">
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono text-2xl font-bold tracking-tight text-zinc-100">
                      {summary.lowestCourse ? summary.lowestCourse.code : "—"}
                    </span>
                    {summary.lowestCourse?.currentPercent !== null &&
                      summary.lowestCourse?.currentPercent !== undefined && (
                        <span className="text-lg font-semibold text-amber-400 font-mono">
                          <CountUp
                            value={summary.lowestCourse.currentPercent}
                            suffix="%"
                          />
                        </span>
                      )}
                  </div>
                  <p className="text-xs text-zinc-400">
                    {summary.lowestCourse
                      ? summary.lowestCourse.status === "warning"
                        ? "Warning (below 80% safe cushion)"
                        : summary.lowestCourse.status === "danger"
                        ? "Danger (below 75% exam limit)"
                        : "Safe (≥80% cushion)"
                      : "No active courses"}
                  </p>
                </CardContent>
              </Card>
            </motion.div>

            {/* Safest course */}
            <motion.div variants={itemVariants}>
              <Card className="border-zinc-800/80 bg-zinc-900/60 p-4 sm:p-5 shadow-sm backdrop-blur-sm hover:border-zinc-700/80 transition-colors">
                <CardHeader className="p-0 pb-1.5">
                  <CardTitle className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                    Safest course
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0 space-y-1">
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono text-2xl font-bold tracking-tight text-zinc-100">
                      {summary.safestCourse ? summary.safestCourse.code : "—"}
                    </span>
                    {summary.safestCourse?.currentPercent !== null &&
                      summary.safestCourse?.currentPercent !== undefined && (
                        <span className="text-lg font-semibold text-emerald-400 font-mono">
                          <CountUp
                            value={summary.safestCourse.currentPercent}
                            suffix="%"
                          />
                        </span>
                      )}
                  </div>
                  <p className="text-xs text-zinc-400">
                    {summary.safestCourse
                      ? `Highest cushion (${summary.safestCourse.safeSkips} safe skips left)`
                      : "No active courses"}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        </section>

        {/* Course Cards Grid */}
        <section aria-labelledby="courses-heading" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2
              id="courses-heading"
              className="text-base font-semibold tracking-tight text-zinc-100 sm:text-lg"
            >
              Courses ({analyzedCourses.length})
            </h2>
            <span className="text-[11px] text-zinc-400">
              Exam limit: 75% • Cushion: 80%
            </span>
          </div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
          >
            {analyzedCourses.map(({ course, analysis }) => {
              const statusCfg = STATUS_CONFIG[analysis.status];
              const StatusIcon = statusCfg.icon;
              const hasStarted =
                analysis.status !== "not_started" &&
                analysis.currentPercent !== null;
              const percentValue = hasStarted
                ? analysis.currentPercent ?? 0
                : undefined;
              const creditText =
                course.prCredits > 0
                  ? `${course.thCredits} Th + ${course.prCredits} Pr`
                  : `${course.thCredits} Th`;

              return (
                <motion.div key={course.code} variants={itemVariants}>
                  <Card className="flex h-full flex-col justify-between border-zinc-800/80 bg-zinc-900/60 p-4.5 sm:p-5 shadow-sm backdrop-blur-sm hover:border-zinc-700 transition-colors">
                    <div className="space-y-4">
                      {/* Card Header */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <CardTitle className="font-mono text-xl font-bold tracking-tight text-zinc-100">
                            {analysis.code}
                          </CardTitle>
                          <p className="mt-0.5 text-xs text-zinc-400">
                            {creditText}
                          </p>
                        </div>
                        <Badge
                          variant="outline"
                          className={`flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-semibold rounded-md ${statusCfg.badgeClass}`}
                        >
                          <StatusIcon className="size-3.5 shrink-0" />
                          <span>{statusCfg.label}</span>
                        </Badge>
                      </div>

                      {/* Current Attendance Display */}
                      <div>
                        {hasStarted && percentValue !== undefined ? (
                          <div>
                            <div className="text-3xl font-bold tracking-tight text-zinc-100 font-mono">
                              <CountUp value={percentValue} suffix="%" />
                            </div>
                            <div className="mt-0.5 text-xs text-zinc-400">
                              {course.prCredits > 0
                                ? `Theory: ${course.thPresent}/${course.thHeld} • Practical: ${course.prPresent}/${course.prHeld}`
                                : `Theory: ${course.thPresent}/${course.thHeld} held`}
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div className="text-2xl font-semibold tracking-tight text-zinc-400">
                              Not started yet
                            </div>
                            <div className="mt-0.5 text-xs text-zinc-400">
                              0/0 classes held so far
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Progress Bar with Tick Marks at 75% and 80% */}
                      <div className="space-y-2">
                        <div
                          className="relative h-3 w-full overflow-hidden rounded-full bg-zinc-950/80 border border-zinc-800/80"
                          role="progressbar"
                          aria-valuenow={percentValue}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label={`Attendance progress for ${analysis.code}`}
                        >
                          {/* Animated filled bar */}
                          {hasStarted && percentValue !== undefined && (
                            <motion.div
                              className={`h-full rounded-full ${statusCfg.barColor}`}
                              initial={{
                                width: shouldReduceMotion
                                  ? `${Math.min(100, Math.max(0, percentValue))}%`
                                  : "0%",
                              }}
                              animate={{
                                width: `${Math.min(100, Math.max(0, percentValue))}%`,
                              }}
                              transition={{
                                duration: shouldReduceMotion ? 0 : 0.65,
                                ease: "easeOut" as const,
                                delay: shouldReduceMotion ? 0 : 0.15,
                              }}
                            />
                          )}

                          {/* Tick mark at 75% (Hard exam limit) */}
                          <div
                            className="absolute top-0 bottom-0 left-[75%] w-[2px] -ml-[1px] bg-rose-400/90 z-20 pointer-events-none shadow-[0_0_4px_rgba(244,63,94,0.5)]"
                            title="75% Exam Eligibility Limit"
                          />

                          {/* Tick mark at 80% (Safe cushion) */}
                          <div
                            className="absolute top-0 bottom-0 left-[80%] w-[2px] -ml-[1px] bg-emerald-400/95 z-20 pointer-events-none shadow-[0_0_4px_rgba(16,185,129,0.5)]"
                            title="80% Safe Cushion"
                          />
                        </div>

                        {/* Tick Mark Markers & Legend */}
                        <div className="flex items-center justify-between text-[11px] text-zinc-400 select-none">
                          <span>0%</span>
                          <div className="flex items-center gap-2.5 sm:gap-3">
                            <span className="inline-flex items-center gap-1 text-rose-400/90 font-medium">
                              <span className="inline-block size-1.5 rounded-full bg-rose-500" />
                              75% limit
                            </span>
                            <span className="inline-flex items-center gap-1 text-emerald-400/90 font-medium">
                              <span className="inline-block size-1.5 rounded-full bg-emerald-500" />
                              80% cushion
                            </span>
                          </div>
                          <span>100%</span>
                        </div>
                      </div>

                      {/* Skips / Recovery Guidance */}
                      <div>
                        {analysis.status === "danger" ? (
                          <div className="rounded-lg border border-rose-500/30 bg-rose-950/30 p-3 text-xs text-rose-300">
                            <p className="font-medium leading-relaxed">
                              Attend every remaining class to recover. You can miss at most{" "}
                              <span className="font-mono font-bold text-rose-200">
                                <CountUp value={analysis.hardSkips} decimals={0} />
                              </span>{" "}
                              more.
                            </p>
                          </div>
                        ) : analysis.status === "not_started" ? (
                          <div className="rounded-lg border border-zinc-800/80 bg-zinc-950/40 p-3 text-xs text-zinc-400">
                            <span>No classes have been recorded yet for this course.</span>
                          </div>
                        ) : (
                          <div className="space-y-2 rounded-lg border border-zinc-800/80 bg-zinc-950/50 p-3 text-xs">
                            <div className="flex items-center justify-between">
                              <span className="text-zinc-400">
                                Safe skips (stays above 80%):
                              </span>
                              <span className="font-mono text-sm font-semibold text-emerald-400">
                                <CountUp value={analysis.safeSkips} decimals={0} />
                              </span>
                            </div>
                            <div className="flex items-center justify-between border-t border-zinc-800/60 pt-2">
                              <span className="text-zinc-400">
                                Hard limit (stays above 75%):
                              </span>
                              <span className="font-mono text-sm font-semibold text-rose-400">
                                <CountUp value={analysis.hardSkips} decimals={0} />
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </motion.div>
        </section>

        {/* Disclaimer Note */}
        <footer className="rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-3.5 sm:p-4 text-center text-xs text-zinc-400">
          <div className="flex items-center justify-center gap-2">
            <Info className="size-4 shrink-0 text-zinc-400" />
            <p>
              Estimates based on a 16-week semester. The official university record decides eligibility.
            </p>
          </div>
        </footer>
      </div>
    </main>
  );
}
