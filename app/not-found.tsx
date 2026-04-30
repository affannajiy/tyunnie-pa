// app/not-found.tsx
"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { getRandomQuote } from "@/lib/tyunnieQuotes";

// ── Runner game constants ──
const CANVAS_H = 160;
const GROUND_Y = 130;
const PLAYER_X = 60;
const PLAYER_W = 28;
const PLAYER_H = 40;
const PLAYER_STANDING_Y = GROUND_Y - PLAYER_H;
const BASE_SPEED = 4;
const GRAVITY = 0.7;
const JUMP_VY = -14;

type Obstacle = { x: number; w: number; h: number };
type RunnerRef = {
  state: "idle" | "running" | "dead";
  playerY: number;
  playerVY: number;
  onGround: boolean;
  obstacles: Obstacle[];
  score: number;
  speed: number;
  distSinceLast: number;
  nextGap: number;
  deathQuote: string;
  highScore: number;
  rafId: number;
};

export default function NotFound() {
  const [accentRgb, setAccentRgb] = useState("249,115,22");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<RunnerRef>({
    state: "idle",
    playerY: PLAYER_STANDING_Y,
    playerVY: 0,
    onGround: true,
    obstacles: [],
    score: 0,
    speed: BASE_SPEED,
    distSinceLast: 0,
    nextGap: 380,
    deathQuote: "",
    highScore: 0,
    rafId: 0,
  });
  const [gameState, setGameState] = useState<"idle" | "running" | "dead">("idle");

  useEffect(() => {
    const saved = localStorage.getItem("tyunnie_accent");
    if (saved) setAccentRgb(saved);
  }, []);

  useEffect(() => {
    const canvasEl = canvasRef.current;
    if (!canvasEl) return;
    // Re-bind after null check so TypeScript preserves HTMLCanvasElement type in closures
    const canvas: HTMLCanvasElement = canvasEl;

    const hs = localStorage.getItem("tyunnie_runner_hs");
    if (hs) gameRef.current.highScore = parseInt(hs) || 0;

    function getAccentRgbDynamic(): string {
      return (
        getComputedStyle(document.documentElement)
          .getPropertyValue("--accent-rgb")
          .trim() || "249,115,22"
      );
    }

    function randomGap(): number {
      return 220 + Math.floor(Math.random() * 161);
    }

    function jump() {
      const g = gameRef.current;
      if (g.state === "idle") {
        g.state = "running";
        g.playerVY = JUMP_VY;
        g.onGround = false;
        setGameState("running");
      } else if (g.state === "running" && g.onGround) {
        g.playerVY = JUMP_VY;
        g.onGround = false;
      } else if (g.state === "dead") {
        g.state = "idle";
        g.playerY = PLAYER_STANDING_Y;
        g.playerVY = 0;
        g.onGround = true;
        g.obstacles = [];
        g.score = 0;
        g.speed = BASE_SPEED;
        g.distSinceLast = 0;
        g.nextGap = randomGap();
        g.deathQuote = "";
        setGameState("idle");
      }
    }

    function drawObstacle(
      ctx: CanvasRenderingContext2D,
      obs: Obstacle,
      rgb: string,
    ) {
      const oy = GROUND_Y - obs.h;
      const block = 10;
      ctx.fillStyle = `rgba(${rgb},0.65)`;
      for (let bx = 0; bx < obs.w; bx += block) {
        for (let by = 0; by < obs.h; by += block) {
          ctx.fillRect(
            obs.x + bx + 0.5,
            oy + by + 0.5,
            Math.min(block, obs.w - bx) - 1,
            Math.min(block, obs.h - by) - 1,
          );
        }
      }
    }

    function draw() {
      const g = gameRef.current;
      const W = canvas.width;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const rgb = getAccentRgbDynamic();

      ctx.clearRect(0, 0, W, CANVAS_H);

      // Ground line
      ctx.strokeStyle = `rgba(${rgb},0.4)`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, GROUND_Y);
      ctx.lineTo(W, GROUND_Y);
      ctx.stroke();

      // Player body
      ctx.fillStyle = "#2a1f14";
      ctx.fillRect(PLAYER_X, g.playerY, PLAYER_W, PLAYER_H);
      // Eyes — tiny white dot
      ctx.fillStyle = "rgba(255,255,255,0.65)";
      ctx.fillRect(PLAYER_X + 18, g.playerY + 9, 4, 4);

      // Obstacles
      g.obstacles.forEach((obs) => drawObstacle(ctx, obs, rgb));

      // Score top-right
      ctx.textAlign = "right";
      ctx.fillStyle = "rgba(154,143,126,0.9)";
      ctx.font = '11px "Geist Mono", ui-monospace, monospace';
      ctx.fillText(String(g.score), W - 12, 20);
      if (g.highScore > 0) {
        ctx.fillStyle = "rgba(154,143,126,0.5)";
        ctx.font = '9px "Geist Mono", ui-monospace, monospace';
        ctx.fillText(`HI ${g.highScore}`, W - 12, 34);
      }
      ctx.textAlign = "left";

      if (g.state === "idle") {
        ctx.fillStyle = "rgba(154,143,126,0.7)";
        ctx.font = '11px "Geist Mono", ui-monospace, monospace';
        ctx.textAlign = "center";
        ctx.fillText("Press Space or tap to start", W / 2, CANVAS_H / 2 + 5);
        ctx.textAlign = "left";
      }

      if (g.state === "dead") {
        ctx.fillStyle = "rgba(0,0,0,0.65)";
        ctx.fillRect(0, 0, W, CANVAS_H);

        const midX = W / 2;
        ctx.textAlign = "center";

        ctx.fillStyle = `rgba(${rgb},1)`;
        ctx.font = 'bold 13px "Geist Mono", ui-monospace, monospace';
        ctx.fillText(`Score: ${g.score}`, midX, CANVAS_H / 2 - 24);

        // Scale quote font to fit canvas width
        const maxQuoteW = W - 36;
        const quoteText = `“${g.deathQuote}”`;
        let fontSize = 11;
        ctx.font = `italic ${fontSize}px serif`;
        while (fontSize > 7 && ctx.measureText(quoteText).width > maxQuoteW) {
          fontSize -= 1;
          ctx.font = `italic ${fontSize}px serif`;
        }
        ctx.fillStyle = "rgba(184,162,133,0.9)";
        ctx.fillText(quoteText, midX, CANVAS_H / 2 - 2);

        ctx.fillStyle = "rgba(120,108,90,0.9)";
        ctx.font = '10px "Geist Mono", ui-monospace, monospace';
        ctx.fillText("Press Space or tap to restart", midX, CANVAS_H / 2 + 20);

        ctx.textAlign = "left";
      }
    }

    function loop() {
      const g = gameRef.current;

      if (g.state === "running") {
        // Physics
        g.playerVY += GRAVITY;
        g.playerY += g.playerVY;
        if (g.playerY >= PLAYER_STANDING_Y) {
          g.playerY = PLAYER_STANDING_Y;
          g.playerVY = 0;
          g.onGround = true;
        }

        // Ramp speed + score
        g.speed += 0.0015;
        g.score += 1;

        // Spawn obstacle by distance traveled
        g.distSinceLast += g.speed;
        if (g.distSinceLast >= g.nextGap) {
          const isTall = Math.random() < 0.5;
          g.obstacles.push({
            x: canvas.width,
            w: isTall ? 16 : 30,
            h: isTall ? 40 : 20,
          });
          g.distSinceLast = 0;
          g.nextGap = randomGap();
        }

        // Move obstacles left
        for (const obs of g.obstacles) obs.x -= g.speed;
        g.obstacles = g.obstacles.filter((obs) => obs.x + obs.w > -10);

        // Collision — AABB with 4px forgiveness margin
        const margin = 4;
        const px1 = PLAYER_X + margin;
        const px2 = PLAYER_X + PLAYER_W - margin;
        const py1 = g.playerY + margin;
        const py2 = g.playerY + PLAYER_H - margin;
        for (const obs of g.obstacles) {
          const ox1 = obs.x + margin;
          const ox2 = obs.x + obs.w - margin;
          const oy1 = GROUND_Y - obs.h + margin;
          const oy2 = GROUND_Y - margin;
          if (px1 < ox2 && px2 > ox1 && py1 < oy2 && py2 > oy1) {
            g.state = "dead";
            g.deathQuote = getRandomQuote();
            if (g.score > g.highScore) {
              g.highScore = g.score;
              localStorage.setItem("tyunnie_runner_hs", String(g.score));
            }
            setGameState("dead");
            break;
          }
        }
      }

      draw();
      g.rafId = requestAnimationFrame(loop);
    }

    function updateSize() {
      const parent = canvas.parentElement;
      canvas.width = parent ? Math.min(480, parent.clientWidth) : 480;
      canvas.height = CANVAS_H;
    }
    updateSize();
    window.addEventListener("resize", updateSize);

    function onKeyDown(e: KeyboardEvent) {
      if (e.code === "Space" || e.code === "ArrowUp") {
        e.preventDefault();
        jump();
      }
    }
    function onTouchEnd(e: TouchEvent) {
      e.preventDefault();
      jump();
    }

    window.addEventListener("keydown", onKeyDown);
    canvas.addEventListener("touchend", onTouchEnd, { passive: false });
    canvas.addEventListener("click", jump);

    loop();

    return () => {
      cancelAnimationFrame(gameRef.current.rafId);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", updateSize);
      canvas.removeEventListener("touchend", onTouchEnd);
      canvas.removeEventListener("click", jump);
    };
  }, []);

  const accent = `rgb(${accentRgb})`;

  return (
    <div className="min-h-screen flex bg-[#faf8f5] dark:bg-[#0e0d0b]">

      {/* Left panel — branding + sprite */}
      <div
        className="hidden lg:flex flex-col w-100 shrink-0 relative overflow-hidden"
        style={{ background: `linear-gradient(160deg, rgba(${accentRgb},0.06) 0%, rgba(${accentRgb},0.16) 100%)` }}
      >
        <div className="absolute inset-0 pointer-events-none">
          {[
            { w: 300, h: 300, top: "-60px", left: "-60px", delay: "0s" },
            { w: 200, h: 200, top: "40%",   left: "50%",   delay: "1.8s" },
            { w: 140, h: 140, top: "70%",   left: "-20px", delay: "3s" },
          ].map((b, i) => (
            <div
              key={i}
              className="absolute rounded-full animate-pulse"
              style={{
                width: b.w,
                height: b.h,
                top: b.top,
                left: b.left,
                background: `radial-gradient(circle, rgba(${accentRgb},0.18) 0%, transparent 70%)`,
                animationDelay: b.delay,
                animationDuration: "4s",
              }}
            />
          ))}
        </div>

        <div className="relative z-10 p-10">
          <span className="text-2xl font-bold tracking-tight" style={{ color: accent }}>
            Tyunnie
          </span>
          <p className="text-[#9a8f7e] dark:text-[#7a7060] text-sm mt-1">
            Your personal AI assistant
          </p>
        </div>

        <div className="absolute bottom-0 left-0 right-0 flex justify-center z-10 pointer-events-none">
          <div className="relative">
            <div
              className="absolute inset-0 rounded-full blur-3xl opacity-30"
              style={{ background: `radial-gradient(circle, rgba(${accentRgb},0.5) 0%, transparent 70%)` }}
            />
            <Image
              src="/sprites/tyun-mood-happy.png"
              alt="Tyunnie"
              width={360}
              height={460}
              priority
              style={{ width: "240px", height: "auto", position: "relative", zIndex: 1, display: "block" }}
            />
          </div>
        </div>
      </div>

      {/* Right panel — 404 card */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">

        <div className="lg:hidden mb-8 text-center">
          <span className="text-3xl font-bold" style={{ color: accent }}>Tyunnie</span>
          <p className="text-[#9a8f7e] text-sm mt-1">Your personal AI assistant</p>
        </div>

        <div className="w-full max-w-sm">

          {/* Mobile sprite */}
          <div className="lg:hidden flex justify-center mb-6">
            <Image
              src="/sprites/tyun-mood-happy.png"
              alt="Tyunnie"
              width={360}
              height={460}
              priority
              style={{ width: "110px", height: "auto" }}
            />
          </div>

          <div className="bg-white dark:bg-[#1a1815] border border-[#e8e2d8] dark:border-[#2a2620] rounded-2xl p-8 shadow-xl">
            <p
              className="text-[10px] font-bold uppercase tracking-[3px] font-mono mb-2"
              style={{ color: accent }}
            >
              Error 404
            </p>
            <h1 className="font-serif italic text-3xl text-[#111010] dark:text-[#f5f0e8] mb-3">
              Lost?
            </h1>
            <p className="text-sm text-[#9a8f7e] dark:text-[#6a6050] leading-relaxed mb-4">
              This page does not exist. Even I could not find it — and I know everything.
            </p>

            {/* ── Tyunnie Runner ── */}
            <div className="mb-5">
              <canvas
                ref={canvasRef}
                style={{
                  display: "block",
                  width: "100%",
                  maxWidth: 480,
                  height: CANVAS_H,
                  background: "rgba(0,0,0,0.15)",
                  border: "1px solid rgba(var(--accent-rgb),0.2)",
                  borderRadius: 12,
                  cursor: "pointer",
                  touchAction: "none",
                }}
              />
              {gameState === "idle" && (
                <p className="text-[9px] text-center text-[#9a8f7e] dark:text-[#4a4038] font-mono mt-1.5">
                  tap or press Space to play
                </p>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => window.history.back()}
                className="flex-1 py-3 rounded-xl text-white font-bold text-xs uppercase tracking-widest transition-all hover:opacity-90 hover:-translate-y-px"
                style={{ background: accent }}
              >
                Try Again
              </button>
              <Link
                href="/dashboard"
                className="flex-1 py-3 text-center bg-transparent border border-[#e8e2d8] dark:border-[#2a2620] text-[#9a8f7e] dark:text-[#6a6050] font-bold rounded-xl text-xs uppercase tracking-widest hover:border-[#9a8f7e] dark:hover:border-[#6a6050] transition-all hover:-translate-y-px"
              >
                Dashboard
              </Link>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
