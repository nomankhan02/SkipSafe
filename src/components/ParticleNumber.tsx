"use client";

import { useEffect, useState, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";

interface ParticleNumberProps {
  value: number;
  decimals?: number;
  suffix?: string;
  className?: string;
}

export function ParticleNumber({
  value,
  decimals,
  suffix = "",
  className = "font-mono font-medium text-3xl tracking-tight",
}: ParticleNumberProps) {
  const shouldReduceMotion = useReducedMotion();
  const precision =
    decimals ?? (value.toString().split(".")[1]?.length || 0);

  const formattedText = `${value.toFixed(precision)}${suffix}`;
  const [assembled, setAssembled] = useState(shouldReduceMotion);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [showCanvas, setShowCanvas] = useState(!shouldReduceMotion);

  useEffect(() => {
    if (shouldReduceMotion) return;

    const canvas = canvasRef.current;
    if (!canvas) {
      setAssembled(true);
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = (canvas.width = 130);
    const height = (canvas.height = 42);

    // Generate flock of tiny micro-particles that coalesce
    const count = 35;
    const particles = Array.from({ length: count }, () => {
      const angle = Math.random() * Math.PI * 2;
      const dist = 18 + Math.random() * 24;
      return {
        startX: width / 2 + Math.cos(angle) * dist,
        startY: height / 2 + Math.sin(angle) * dist,
        targetX: width / 2 + (Math.random() - 0.5) * 20,
        targetY: height / 2 + (Math.random() - 0.5) * 10,
        size: 0.8 + Math.random() * 1.2,
        alpha: 0.8 + Math.random() * 0.2,
      };
    });

    const startTime = performance.now();
    const duration = 750; // ms

    let animId: number;
    const animate = (time: number) => {
      const elapsed = time - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // easeOutCubic
      const ease = 1 - Math.pow(1 - progress, 3);

      ctx.clearRect(0, 0, width, height);

      particles.forEach((p) => {
        const curX = p.startX + (p.targetX - p.startX) * ease;
        const curY = p.startY + (p.targetY - p.startY) * ease;
        const alpha = p.alpha * (1 - progress * 0.85);

        ctx.beginPath();
        ctx.arc(curX, curY, p.size * (1 - progress * 0.3), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(52, 211, 153, ${alpha})`;
        ctx.shadowColor = "rgba(52, 211, 153, 0.5)";
        ctx.shadowBlur = 3;
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      if (progress < 1) {
        animId = requestAnimationFrame(animate);
      } else {
        setAssembled(true);
        setTimeout(() => setShowCanvas(false), 200);
      }
    };

    animId = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animId);
  }, [shouldReduceMotion]);

  if (shouldReduceMotion) {
    return <span className={className}>{formattedText}</span>;
  }

  return (
    <div className="relative inline-flex items-center">
      {showCanvas && (
        <canvas
          ref={canvasRef}
          className="pointer-events-none absolute inset-0 -top-1 -left-2 z-10 size-full"
          aria-hidden="true"
        />
      )}
      <motion.span
        initial={{ opacity: 0, filter: "blur(6px)", scale: 0.94 }}
        animate={{
          opacity: 1,
          filter: "blur(0px)",
          scale: 1,
        }}
        transition={{
          duration: 0.55,
          delay: 0.25,
          ease: [0.25, 1, 0.5, 1],
        }}
        className={className}
      >
        {formattedText}
      </motion.span>
    </div>
  );
}
