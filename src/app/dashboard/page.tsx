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
import { BackgroundParticleCanvas } from "@/components/BackgroundParticleCanvas";
import { Interactive3DLogo } from "@/components/Interactive3DLogo";
import { ParticleNumber } from "@/components/ParticleNumber";
import {
  MorphingPopover,
  MorphingPopoverTrigger,
  MorphingPopoverContent,
} from "@/components/ui/morphing-popover";
import {
  ShieldCheck,
  AlertTriangle,
  AlertOctagon,
  Clock,
  Sparkles,
  Info,
  BookOpen,
  Sun,
  Moon,
} from "lucide-react";

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
    badgeClass: "border-emerald-500/40 bg-emerald-950/60 text-emerald-400 font-medium",
    barColor: "bg-emerald-500",
    icon: ShieldCheck,
  },
  warning: {
    label: "Warning",
    badgeClass: "border-amber-500/40 bg-amber-950/60 text-amber-400 font-medium",
    barColor: "bg-amber-500",
    icon: AlertTriangle,
  },
  danger: {
    label: "Danger",
    badgeClass: "border-rose-500/40 bg-rose-950/60 text-rose-400 font-medium",
    barColor: "bg-rose-500",
    icon: AlertOctagon,
  },
  not_started: {
    label: "Not started",
    badgeClass: "border-slate-700 bg-slate-800/70 text-slate-400 font-medium",
    barColor: "bg-transparent",
    icon: Clock,
  },
};

export default function DashboardPage() {
  const shouldReduceMotion = useReducedMotion();
  const [isDark, setIsDark] = useState(true);

  // Synchronize theme toggle with document root
  useEffect(() => {
    const isDarkStored = document.documentElement.classList.contains("dark");
    setIsDark(isDarkStored);
  }, []);

  const toggleTheme = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    if (nextDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
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
    <main className="relative min-h-screen bg-[#0f172a] text-slate-100 dark:bg-[#0f172a] dark:text-slate-100 antialiased selection:bg-emerald-500/30 selection:text-emerald-200 transition-colors duration-300">
      {/* Background ambient micro-particle canvas (500+ particles with continuous drift) */}
      <BackgroundParticleCanvas />

      <div className="relative z-10 mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-9 space-y-7">
        {/* Header with 3D Rotatable Logo, Heading & Theme Switch */}
        <header className="flex flex-col gap-4 border-b border-white/10 pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3.5">
            {/* Interactive 3D rotatable minimal monochrome logo */}
            <div className="relative flex items-center justify-center p-1 rounded-2xl bg-white/5 border border-white/10 shadow-inner backdrop-blur-md">
              <Interactive3DLogo className="size-11" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                  SkipSafe
                </h1>
                <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-1.5 py-0.5 rounded-md">
                  v1.2
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-400 sm:text-sm">
                Attendance report system • Real exam eligibility: 75% • Safe cushion: 80%
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-start sm:self-auto">
            {/* Dark / Light Mode Switch */}
            <Button
              variant="outline"
              size="sm"
              onClick={toggleTheme}
              aria-label="Toggle dark/light theme"
              className="rounded-xl border-white/15 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white shadow-sm backdrop-blur-sm transition-all size-8.5 p-0 flex items-center justify-center"
            >
              {isDark ? (
                <Sun className="size-4 text-amber-400 transition-transform hover:rotate-45" />
              ) : (
                <Moon className="size-4 text-slate-300 transition-transform hover:-rotate-12" />
              )}
            </Button>

            {/* “Ask SkipSafe” button */}
            <motion.div whileTap={{ scale: shouldReduceMotion ? 1 : 0.98 }}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {}}
                className="rounded-xl border-white/15 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white shadow-sm backdrop-blur-sm transition-all text-xs font-medium gap-1.5 h-8.5 px-3"
              >
                <Sparkles className="size-3.5 text-emerald-400 shrink-0" />
                <span>Ask SkipSafe</span>
              </Button>
            </motion.div>

            <Badge
              variant="outline"
              className="rounded-xl border-white/10 bg-white/5 text-[11px] text-slate-300 px-2.5 py-1 font-normal backdrop-blur-sm"
            >
              16-Week Semester
            </Badge>
          </div>
        </header>

        {/* Summary Row */}
        <section aria-labelledby="summary-heading" className="space-y-3">
          <h2
            id="summary-heading"
            className="text-[11px] font-semibold uppercase tracking-wider text-slate-400"
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
            <motion.div
              variants={itemVariants}
              whileHover={{ y: shouldReduceMotion ? 0 : -2 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
            >
              <Card className="rounded-2xl border-white/10 bg-slate-800/40 p-4.5 sm:p-5 shadow-lg shadow-black/10 backdrop-blur-xl hover:border-white/20 transition-all">
                <CardHeader className="p-0 pb-1.5">
                  <CardTitle className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
                    Courses at risk
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0 space-y-1">
                  <div className="flex items-baseline gap-2">
                    <span
                      className={`text-3xl font-medium tracking-tight font-mono ${
                        summary.coursesAtRiskCount > 0
                          ? "text-rose-400"
                          : "text-white"
                      }`}
                    >
                      <ParticleNumber
                        value={summary.coursesAtRiskCount}
                        decimals={0}
                        className="text-3xl font-medium font-mono tracking-tight"
                      />
                    </span>
                    <span className="text-xs text-slate-400">
                      {summary.coursesAtRiskCount === 1 ? "course" : "courses"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
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
            <motion.div
              variants={itemVariants}
              whileHover={{ y: shouldReduceMotion ? 0 : -2 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
            >
              <Card className="rounded-2xl border-white/10 bg-slate-800/40 p-4.5 sm:p-5 shadow-lg shadow-black/10 backdrop-blur-xl hover:border-white/20 transition-all">
                <CardHeader className="p-0 pb-1.5">
                  <CardTitle className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
                    Lowest attendance
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0 space-y-1">
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono text-2xl font-medium tracking-tight text-white">
                      {summary.lowestCourse ? summary.lowestCourse.code : "—"}
                    </span>
                    {summary.lowestCourse?.currentPercent !== null &&
                      summary.lowestCourse?.currentPercent !== undefined && (
                        <span className="text-lg font-medium text-amber-400 font-mono">
                          <ParticleNumber
                            value={summary.lowestCourse.currentPercent}
                            suffix="%"
                            className="text-lg font-medium text-amber-400 font-mono"
                          />
                        </span>
                      )}
                  </div>
                  <p className="text-xs text-slate-400">
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
            <motion.div
              variants={itemVariants}
              whileHover={{ y: shouldReduceMotion ? 0 : -2 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
            >
              <Card className="rounded-2xl border-white/10 bg-slate-800/40 p-4.5 sm:p-5 shadow-lg shadow-black/10 backdrop-blur-xl hover:border-white/20 transition-all">
                <CardHeader className="p-0 pb-1.5">
                  <CardTitle className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
                    Safest course
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0 space-y-1">
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono text-2xl font-medium tracking-tight text-white">
                      {summary.safestCourse ? summary.safestCourse.code : "—"}
                    </span>
                    {summary.safestCourse?.currentPercent !== null &&
                      summary.safestCourse?.currentPercent !== undefined && (
                        <span className="text-lg font-medium text-emerald-400 font-mono">
                          <ParticleNumber
                            value={summary.safestCourse.currentPercent}
                            suffix="%"
                            className="text-lg font-medium text-emerald-400 font-mono"
                          />
                        </span>
                      )}
                  </div>
                  <p className="text-xs text-slate-400">
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
              className="text-base font-semibold tracking-tight text-white sm:text-lg"
            >
              Courses ({analyzedCourses.length})
            </h2>
            <span className="text-[11px] text-slate-400">
              Exam limit: 75% • Cushion: 80%
            </span>
          </div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3"
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
                <motion.div
                  key={course.code}
                  variants={itemVariants}
                  whileHover={{ y: shouldReduceMotion ? 0 : -3 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  className="h-full"
                >
                  {/* Bubbly clear glass card (WITHOUT overflow-hidden so popover expands freely!) */}
                  <Card className="relative flex h-full flex-col justify-between rounded-2xl border-white/10 bg-slate-800/40 p-4.5 sm:p-5 shadow-xl shadow-black/10 backdrop-blur-xl hover:border-white/20 transition-all">
                    <div className="space-y-4">
                      {/* Card Header */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <CardTitle className="font-mono text-xl font-bold tracking-tight text-white">
                            {analysis.code}
                          </CardTitle>
                          <p className="mt-0.5 text-xs text-slate-400">
                            {creditText}
                          </p>
                        </div>
                        <Badge
                          variant="outline"
                          className={`flex items-center gap-1.5 px-2.5 py-0.5 text-xs rounded-lg ${statusCfg.badgeClass}`}
                        >
                          <StatusIcon className="size-3.5 shrink-0" />
                          <span>{statusCfg.label}</span>
                        </Badge>
                      </div>

                      {/* Current Attendance Display */}
                      <div>
                        {hasStarted && percentValue !== undefined ? (
                          <div>
                            <div className="text-3xl font-medium tracking-tight text-white font-mono">
                              <ParticleNumber
                                value={percentValue}
                                suffix="%"
                                className="text-3xl font-medium font-mono tracking-tight text-white"
                              />
                            </div>
                            <div className="mt-0.5 text-xs text-slate-400">
                              {course.prCredits > 0
                                ? `Theory: ${course.thPresent}/${course.thHeld} • Practical: ${course.prPresent}/${course.prHeld}`
                                : `Theory: ${course.thPresent}/${course.thHeld} held`}
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div className="text-2xl font-medium tracking-tight text-slate-400">
                              Not started yet
                            </div>
                            <div className="mt-0.5 text-xs text-slate-400">
                              0/0 classes held so far
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Progress Bar with Tick Marks at 75% and 80% */}
                      <div className="space-y-2">
                        <div
                          className="relative h-2.5 w-full overflow-hidden rounded-full bg-slate-900/80 border border-white/10"
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
                                delay: shouldReduceMotion ? 0 : 0.12,
                              }}
                            />
                          )}

                          {/* Tick mark at 75% (Neutral slate, NOT red!) */}
                          <div
                            className="absolute top-0 bottom-0 left-[75%] w-[2px] -ml-[1px] bg-slate-400/90 z-20 pointer-events-none"
                            title="75% Exam Eligibility Limit"
                          />

                          {/* Tick mark at 80% (Safe cushion, emerald) */}
                          <div
                            className="absolute top-0 bottom-0 left-[80%] w-[2px] -ml-[1px] bg-emerald-400 z-20 pointer-events-none shadow-[0_0_4px_rgba(52,211,153,0.5)]"
                            title="80% Safe Cushion"
                          />
                        </div>

                        {/* Tick Mark Markers & Legend (Neutral for 75%, Emerald for 80%) */}
                        <div className="flex items-center justify-between text-[11px] text-slate-400 select-none">
                          <span>0%</span>
                          <div className="flex items-center gap-2.5 sm:gap-3">
                            <span className="inline-flex items-center gap-1 text-slate-400 font-medium">
                              <span className="inline-block size-1.5 rounded-full bg-slate-400" />
                              75% limit
                            </span>
                            <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
                              <span className="inline-block size-1.5 rounded-full bg-emerald-400" />
                              80% cushion
                            </span>
                          </div>
                          <span>100%</span>
                        </div>
                      </div>

                      {/* Skips / Recovery Guidance */}
                      <div>
                        {analysis.status === "danger" ? (
                          /* RED IS ONLY FOR ACTUAL DANGER */
                          <div className="rounded-xl border border-rose-500/40 bg-rose-950/40 p-3 text-xs text-rose-300">
                            <p className="font-medium leading-relaxed">
                              Attend every remaining class to recover. You can miss at most{" "}
                              <span className="font-mono font-medium text-rose-200">
                                <ParticleNumber
                                  value={analysis.hardSkips}
                                  decimals={0}
                                  className="font-mono font-medium text-rose-200 text-xs"
                                />
                              </span>{" "}
                              more.
                            </p>
                          </div>
                        ) : analysis.status === "not_started" ? (
                          <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3 text-xs text-slate-400">
                            <span>No classes have been recorded yet for this course.</span>
                          </div>
                        ) : (
                          <div className="space-y-2 rounded-xl border border-white/10 bg-slate-900/60 p-3 text-xs">
                            <div className="flex items-center justify-between">
                              <span className="text-slate-400">
                                Safe skips (stays above 80%):
                              </span>
                              <span className="font-mono text-sm font-medium text-emerald-400">
                                <ParticleNumber
                                  value={analysis.safeSkips}
                                  decimals={0}
                                  className="font-mono text-sm font-medium text-emerald-400"
                                />
                              </span>
                            </div>
                            <div className="flex items-center justify-between border-t border-white/10 pt-2">
                              <span className="text-slate-400">
                                Hard limit (stays above 75%):
                              </span>
                              {/* CALM CRISP NEUTRAL/WHITE NUMBER, NOT RED! */}
                              <span className="font-mono text-sm font-medium text-slate-200">
                                <ParticleNumber
                                  value={analysis.hardSkips}
                                  decimals={0}
                                  className="font-mono text-sm font-medium text-slate-200"
                                />
                              </span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Morphing Popover for extra course details (uncut, clean popover floating outside card!) */}
                      <div className="relative pt-1 z-30">
                        <MorphingPopover
                          variants={{
                            initial: { opacity: 0, scale: 0.95 },
                            animate: { opacity: 1, scale: 1 },
                            exit: { opacity: 0, scale: 0.95 },
                          }}
                          transition={{
                            duration: 0.25,
                            ease: "easeOut",
                          }}
                        >
                          <MorphingPopoverTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full rounded-xl border-white/10 bg-white/5 hover:bg-white/10 text-xs text-slate-300 hover:text-white gap-1.5 justify-center py-2 h-8 transition-colors"
                            >
                              <BookOpen className="size-3.5 text-slate-400" />
                              <span>Course Details & Info</span>
                            </Button>
                          </MorphingPopoverTrigger>
                          <MorphingPopoverContent className="bottom-11 left-1/2 -translate-x-1/2 w-[310px] max-w-[calc(100vw-2rem)] rounded-2xl border border-white/20 bg-slate-900/98 p-4 text-slate-100 shadow-2xl backdrop-blur-2xl z-50">
                            <div className="space-y-3.5 text-xs">
                              {/* Popover Header */}
                              <div className="border-b border-white/10 pb-2.5">
                                <div className="flex items-center justify-between">
                                  <h4 className="font-mono text-base font-bold text-white">
                                    {course.code}
                                  </h4>
                                  <Badge
                                    variant="outline"
                                    className={`px-2 py-0.5 text-[11px] rounded-md ${statusCfg.badgeClass}`}
                                  >
                                    {statusCfg.label}
                                  </Badge>
                                </div>
                                <p className="text-slate-400 text-[11px] mt-0.5">
                                  {creditText} • Weightage Breakdown
                                </p>
                              </div>

                              {/* Breakdown Grid */}
                              <div className="grid grid-cols-2 gap-2">
                                <div className="rounded-xl border border-white/10 bg-slate-800/50 p-2.5">
                                  <div className="text-[10px] uppercase tracking-wider text-slate-400">
                                    Theory Classes
                                  </div>
                                  <div className="text-sm font-medium font-mono text-white mt-0.5">
                                    {course.thPresent} / {course.thHeld} held
                                  </div>
                                  <div className="text-[10px] text-slate-400 mt-0.5">
                                    Planned: {course.thPlanned ?? course.thCredits * 16}
                                  </div>
                                </div>

                                <div className="rounded-xl border border-white/10 bg-slate-800/50 p-2.5">
                                  <div className="text-[10px] uppercase tracking-wider text-slate-400">
                                    Practical Sessions
                                  </div>
                                  <div className="text-sm font-medium font-mono text-white mt-0.5">
                                    {course.prCredits > 0
                                      ? `${course.prPresent} / ${course.prHeld} held`
                                      : "None"}
                                  </div>
                                  <div className="text-[10px] text-slate-400 mt-0.5">
                                    {course.prCredits > 0
                                      ? `${course.prCredits} Lab Credit`
                                      : "Theory only"}
                                  </div>
                                </div>
                              </div>

                              {/* Rules & Cushion Info */}
                              <div className="rounded-xl border border-white/10 bg-slate-800/40 p-2.5 space-y-1.5 text-[11px]">
                                <div className="flex items-center justify-between">
                                  <span className="text-slate-400">
                                    Safe Cushion Target (80%):
                                  </span>
                                  <span className="font-mono font-medium text-emerald-400">
                                    {analysis.safeSkips} skips left
                                  </span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-slate-400">
                                    Exam Eligibility Limit (75%):
                                  </span>
                                  <span className="font-mono font-medium text-slate-200">
                                    {analysis.hardSkips} skips left
                                  </span>
                                </div>
                              </div>

                              <div className="text-[10px] text-slate-400 leading-tight">
                                Note: All attendance metrics are dynamically calculated per 16-week curriculum rules. Click outside or press Esc to dismiss.
                              </div>
                            </div>
                          </MorphingPopoverContent>
                        </MorphingPopover>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </motion.div>
        </section>

        {/* Disclaimer Note */}
        <footer className="rounded-2xl border-white/10 bg-slate-800/40 p-3.5 sm:p-4 text-center text-xs text-slate-400 shadow-lg shadow-black/10 backdrop-blur-xl">
          <div className="flex items-center justify-center gap-2">
            <Info className="size-4 shrink-0 text-slate-400" />
            <p>
              Estimates based on a 16-week semester. The official university record decides eligibility.
            </p>
          </div>
        </footer>
      </div>
    </main>
  );
}
