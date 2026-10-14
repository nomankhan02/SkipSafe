"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  baseAlpha: number;
  colorType: "emerald" | "slate" | "cyan";
  driftAngle: number;
  driftSpeed: number;
}

interface Shockwave {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
}

export function BackgroundParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    if (shouldReduceMotion) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const mousePos = { x: -1000, y: -1000 };
    let shockwaves: Shockwave[] = [];
    let particles: Particle[] = [];

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
      initParticles();
    };

    window.addEventListener("resize", handleResize);

    const initParticles = () => {
      particles = [];
      // High particle density (480 - 650 particles)
      const count = Math.min(550, Math.max(380, Math.floor((width * height) / 3200)));
      for (let i = 0; i < count; i++) {
        const x = Math.random() * width;
        const y = Math.random() * height;
        const rand = Math.random();
        const colorType =
          rand > 0.6 ? "emerald" : rand > 0.3 ? "slate" : "cyan";
        const size = Math.random() * 0.8 + 0.55; // Subtle micro-stardust (0.55px - 1.35px)
        const baseAlpha = Math.random() * 0.32 + 0.2;
        const driftAngle = Math.random() * Math.PI * 2;
        const driftSpeed = 0.12 + Math.random() * 0.18; // Smooth, slow ambient drift

        particles.push({
          x,
          y,
          vx: Math.cos(driftAngle) * driftSpeed,
          vy: Math.sin(driftAngle) * driftSpeed,
          size,
          alpha: baseAlpha,
          baseAlpha,
          colorType,
          driftAngle,
          driftSpeed,
        });
      }
    };

    initParticles();

    // Mouse movement listener
    const handleMouseMove = (e: MouseEvent) => {
      mousePos.x = e.clientX;
      mousePos.y = e.clientY;
    };

    const handleMouseLeave = () => {
      mousePos.x = -1000;
      mousePos.y = -1000;
    };

    // Click creates a gentle local shockwave (does NOT hurl particles far away)
    const handleClick = (e: MouseEvent) => {
      const clickX = e.clientX;
      const clickY = e.clientY;

      shockwaves.push({
        x: clickX,
        y: clickY,
        radius: 4,
        maxRadius: 90, // Contained radius
        alpha: 0.55,
      });

      // Gentle, restrained local push
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        const dx = p.x - clickX;
        const dy = p.y - clickY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 100 && dist > 0) {
          const force = (1 - dist / 100) * 2.2; // Gentle local nudge, not far away
          const angle = Math.atan2(dy, dx);
          p.vx += Math.cos(angle) * force;
          p.vy += Math.sin(angle) * force;
          p.alpha = Math.min(0.85, p.baseAlpha + 0.35);
        }
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseleave", handleMouseLeave);
    window.addEventListener("mousedown", handleClick);

    let time = 0;
    const render = () => {
      time += 1;
      ctx.clearRect(0, 0, width, height);

      // Render subtle shockwave ripple
      for (let s = shockwaves.length - 1; s >= 0; s--) {
        const sw = shockwaves[s];
        sw.radius += 3.5;
        sw.alpha *= 0.93;

        if (sw.alpha > 0.02) {
          ctx.beginPath();
          ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(52, 211, 153, ${sw.alpha * 0.3})`;
          ctx.lineWidth = 1.2;
          ctx.stroke();
        } else {
          shockwaves.splice(s, 1);
        }
      }

      // Small cursor interaction radius
      const repulsionRadius = 60;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // Cursor gentle displacement (soft local push)
        const dx = p.x - mousePos.x;
        const dy = p.y - mousePos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < repulsionRadius && dist > 0) {
          const force = ((repulsionRadius - dist) / repulsionRadius) * 0.5; // Soft touch
          const angle = Math.atan2(dy, dx);
          p.vx += Math.cos(angle) * force;
          p.vy += Math.sin(angle) * force;
        }

        // Air damping so they smoothly return to steady drift
        p.vx *= 0.982;
        p.vy *= 0.982;

        // Maintain continuous gentle drift so they keep circulating and never clump
        const currentSpeed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        if (currentSpeed < p.driftSpeed) {
          p.driftAngle += (Math.random() - 0.5) * 0.03;
          p.vx += Math.cos(p.driftAngle) * 0.025;
          p.vy += Math.sin(p.driftAngle) * 0.025;
        }

        p.x += p.vx;
        p.y += p.vy;

        // Seamless wrap around edges
        if (p.x < -5) p.x = width + 5;
        if (p.x > width + 5) p.x = -5;
        if (p.y < -5) p.y = height + 5;
        if (p.y > height + 5) p.y = -5;

        // Render micro-particle
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);

        if (p.colorType === "emerald") {
          ctx.fillStyle = `rgba(52, 211, 153, ${p.alpha})`;
        } else if (p.colorType === "cyan") {
          ctx.fillStyle = `rgba(56, 189, 248, ${p.alpha * 0.85})`;
        } else {
          ctx.fillStyle = `rgba(203, 213, 225, ${p.alpha * 0.75})`;
        }

        ctx.fill();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseleave", handleMouseLeave);
      window.removeEventListener("mousedown", handleClick);
    };
  }, [shouldReduceMotion]);

  if (shouldReduceMotion) return null;

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-0 size-full"
      aria-hidden="true"
    />
  );
}
