"use client";

import { useState, useEffect, useCallback, useRef } from "react";

// ── TYPES ──
type TetrominoType = "I" | "O" | "T" | "S" | "Z" | "J" | "L";
type Cell = TetrominoType | null;
type Grid = Cell[][];
type Position = { x: number; y: number };

// ── CONSTANTS ──
const COLS = 10;
const ROWS = 20;
const CELL_SIZE = 28;

const TETROMINOES: Record<TetrominoType, number[][]> = {
  I: [[1, 1, 1, 1]],
  O: [
    [1, 1],
    [1, 1],
  ],
  T: [
    [0, 1, 0],
    [1, 1, 1],
  ],
  S: [
    [0, 1, 1],
    [1, 1, 0],
  ],
  Z: [
    [1, 1, 0],
    [0, 1, 1],
  ],
  J: [
    [1, 0, 0],
    [1, 1, 1],
  ],
  L: [
    [0, 0, 1],
    [1, 1, 1],
  ],
};

const COLORS: Record<TetrominoType, string> = {
  I: "#06b6d4",
  O: "#eab308",
  T: "#a855f7",
  S: "#22c55e",
  Z: "#ef4444",
  J: "#3b82f6",
  L: "#f97316",
};

const SCORES = [0, 100, 300, 500, 800];
const LEVEL_SPEED = (level: number) => Math.max(80, 600 - level * 50);

// ── HELPERS ──
function emptyGrid(): Grid {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function randomTetromino(): TetrominoType {
  const types: TetrominoType[] = ["I", "O", "T", "S", "Z", "J", "L"];
  return types[Math.floor(Math.random() * types.length)];
}

function rotate(matrix: number[][]): number[][] {
  const rows = matrix.length;
  const cols = matrix[0].length;
  const result = Array.from({ length: cols }, () => Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) result[c][rows - 1 - r] = matrix[r][c];
  return result;
}

function isValid(grid: Grid, shape: number[][], pos: Position): boolean {
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = pos.x + c;
      const ny = pos.y + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return false;
      if (ny >= 0 && grid[ny][nx]) return false;
    }
  return true;
}

function place(
  grid: Grid,
  shape: number[][],
  pos: Position,
  type: TetrominoType,
): Grid {
  const next = grid.map((row) => [...row]);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const ny = pos.y + r;
      const nx = pos.x + c;
      if (ny >= 0) next[ny][nx] = type;
    }
  return next;
}

function clearLines(grid: Grid): { grid: Grid; lines: number } {
  const kept = grid.filter((row) => row.some((cell) => !cell));
  const lines = ROWS - kept.length;
  const empty = Array.from({ length: lines }, () => Array(COLS).fill(null));
  return { grid: [...empty, ...kept], lines };
}

function ghostPos(grid: Grid, shape: number[][], pos: Position): Position {
  let ghost = { ...pos };
  while (isValid(grid, shape, { ...ghost, y: ghost.y + 1 })) ghost.y++;
  return ghost;
}

// ── COMPONENT ──
export default function Tetris() {
  const [grid, setGrid] = useState<Grid>(emptyGrid);
  const [current, setCurrent] = useState<TetrominoType>(() =>
    randomTetromino(),
  );
  const [shape, setShape] = useState<number[][]>(
    () => TETROMINOES[randomTetromino()],
  );
  const [pos, setPos] = useState<Position>({ x: 3, y: -1 });
  const [next, setNext] = useState<TetrominoType>(() => randomTetromino());
  const [held, setHeld] = useState<TetrominoType | null>(null);
  const [canHold, setCanHold] = useState(true);
  const [score, setScore] = useState(0);
  const [lines, setLines] = useState(0);
  const [level, setLevel] = useState(1);
  const [gameOver, setGameOver] = useState(false);
  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(false);

  const stateRef = useRef({
    grid,
    current,
    shape,
    pos,
    next,
    held,
    canHold,
    score,
    lines,
    level,
    gameOver,
    paused,
  });
  useEffect(() => {
    stateRef.current = {
      grid,
      current,
      shape,
      pos,
      next,
      held,
      canHold,
      score,
      lines,
      level,
      gameOver,
      paused,
    };
  });

  // ── SPAWN NEW PIECE ──
  const spawn = useCallback(
    (type: TetrominoType, nextType: TetrominoType, currentGrid: Grid) => {
      const newShape = TETROMINOES[type];
      const spawnPos = {
        x: Math.floor((COLS - newShape[0].length) / 2),
        y: -1,
      };
      if (!isValid(currentGrid, newShape, spawnPos)) {
        setGameOver(true);
        return;
      }
      setCurrent(type);
      setShape(newShape);
      setPos(spawnPos);
      setNext(nextType);
      setCanHold(true);
    },
    [],
  );

  // ── LOCK PIECE ──
  const lockPiece = useCallback(() => {
    const { grid, current, shape, pos, next } = stateRef.current;
    const newGrid = place(grid, shape, pos, current);
    const { grid: cleared, lines: clearedLines } = clearLines(newGrid);
    const newNextType = randomTetromino();

    setGrid(cleared);
    if (clearedLines > 0) {
      setLines((prev) => {
        const total = prev + clearedLines;
        setLevel(Math.floor(total / 10) + 1);
        return total;
      });
      setScore((prev) => prev + SCORES[clearedLines] * stateRef.current.level);
    }
    spawn(next, newNextType, cleared);
  }, [spawn]);

  // ── MOVE DOWN ──
  const moveDown = useCallback(() => {
    const { grid, shape, pos, gameOver, paused } = stateRef.current;
    if (gameOver || paused) return;
    const newPos = { ...pos, y: pos.y + 1 };
    if (isValid(grid, shape, newPos)) {
      setPos(newPos);
    } else {
      lockPiece();
    }
  }, [lockPiece]);

  // ── GAME TICK ──
  useEffect(() => {
    if (!started || gameOver || paused) return;
    const interval = setInterval(moveDown, LEVEL_SPEED(level));
    return () => clearInterval(interval);
  }, [started, gameOver, paused, level, moveDown]);

  // ── KEYBOARD ──
  useEffect(() => {
    if (!started) return;
    function handleKey(e: KeyboardEvent) {
      const {
        grid,
        shape,
        pos,
        current,
        next,
        held,
        canHold,
        gameOver,
        paused,
      } = stateRef.current;
      if (gameOver) return;

      if (e.key === "Escape" || e.key === "p" || e.key === "P") {
        setPaused((p) => !p);
        return;
      }
      if (paused) return;

      switch (e.key) {
        case "ArrowLeft": {
          const np = { ...pos, x: pos.x - 1 };
          if (isValid(grid, shape, np)) setPos(np);
          break;
        }
        case "ArrowRight": {
          const np = { ...pos, x: pos.x + 1 };
          if (isValid(grid, shape, np)) setPos(np);
          break;
        }
        case "ArrowDown":
          e.preventDefault();
          moveDown();
          break;
        case "ArrowUp":
        case "x":
        case "X": {
          e.preventDefault();
          const rotated = rotate(shape);
          // Wall kicks
          const kicks = [0, -1, 1, -2, 2];
          for (const kick of kicks) {
            const kp = { ...pos, x: pos.x + kick };
            if (isValid(grid, rotated, kp)) {
              setShape(rotated);
              setPos(kp);
              break;
            }
          }
          break;
        }
        case "z":
        case "Z": {
          // Counter-clockwise = rotate 3 times
          let ccw = rotate(rotate(rotate(shape)));
          const kicks = [0, -1, 1, -2, 2];
          for (const kick of kicks) {
            const kp = { ...pos, x: pos.x + kick };
            if (isValid(grid, ccw, kp)) {
              setShape(ccw);
              setPos(kp);
              break;
            }
          }
          break;
        }
        case " ": {
          e.preventDefault();
          // Hard drop
          let ghost = { ...pos };
          while (isValid(grid, shape, { ...ghost, y: ghost.y + 1 })) ghost.y++;
          setPos(ghost);
          // Lock after small delay so state updates
          setTimeout(() => lockPiece(), 0);
          break;
        }
        case "c":
        case "C":
        case "Shift": {
          // Hold
          if (!canHold) break;
          const newHeld = current;
          const spawnType = held ?? next;
          const newNext = held ? next : randomTetromino();
          const newShape = TETROMINOES[spawnType];
          const spawnPos = {
            x: Math.floor((COLS - newShape[0].length) / 2),
            y: -1,
          };
          setHeld(newHeld);
          setCurrent(spawnType);
          setShape(newShape);
          setPos(spawnPos);
          if (!held) setNext(newNext);
          setCanHold(false);
          break;
        }
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [started, moveDown, lockPiece]);

  // ── RESET ──
  function reset() {
    const firstType = randomTetromino();
    const firstShape = TETROMINOES[firstType];
    const nextType = randomTetromino();
    setGrid(emptyGrid());
    setCurrent(firstType);
    setShape(firstShape);
    setPos({ x: Math.floor((COLS - firstShape[0].length) / 2), y: -1 });
    setNext(nextType);
    setHeld(null);
    setCanHold(true);
    setScore(0);
    setLines(0);
    setLevel(1);
    setGameOver(false);
    setPaused(false);
    setStarted(true);
  }

  // ── TOUCH / SWIPE ──
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  function handleTouchStart(e: React.TouchEvent) {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (!touchStart.current || paused || gameOver) return;
    const dx = e.changedTouches[0].clientX - touchStart.current.x;
    const dy = e.changedTouches[0].clientY - touchStart.current.y;
    const { grid, shape, pos } = stateRef.current;

    if (Math.abs(dx) > Math.abs(dy)) {
      // Horizontal swipe
      if (Math.abs(dx) > 20) {
        const np = { ...pos, x: pos.x + (dx > 0 ? 1 : -1) };
        if (isValid(grid, shape, np)) setPos(np);
      }
    } else {
      if (dy > 30) {
        // Swipe down = hard drop
        let ghost = { ...pos };
        while (isValid(grid, shape, { ...ghost, y: ghost.y + 1 })) ghost.y++;
        setPos(ghost);
        setTimeout(() => lockPiece(), 0);
      } else if (dy < -30) {
        // Swipe up = rotate
        const rotated = rotate(shape);
        const kicks = [0, -1, 1, -2, 2];
        for (const kick of kicks) {
          const kp = { ...pos, x: pos.x + kick };
          if (isValid(grid, rotated, kp)) {
            setShape(rotated);
            setPos(kp);
            break;
          }
        }
      }
    }
    touchStart.current = null;
  }

  // ── RENDER GRID ──
  const ghost = !gameOver && started ? ghostPos(grid, shape, pos) : null;

  const displayGrid: (Cell | "ghost")[][] = grid.map((row) => [...row]) as (
    | Cell
    | "ghost"
  )[][];

  // Draw ghost
  if (ghost) {
    for (let r = 0; r < shape.length; r++)
      for (let c = 0; c < shape[r].length; c++) {
        if (!shape[r][c]) continue;
        const ny = ghost.y + r;
        const nx = ghost.x + c;
        if (
          ny >= 0 &&
          ny < ROWS &&
          nx >= 0 &&
          nx < COLS &&
          !displayGrid[ny][nx]
        )
          displayGrid[ny][nx] = "ghost";
      }
  }

  // Draw current piece
  if (started && !gameOver) {
    for (let r = 0; r < shape.length; r++)
      for (let c = 0; c < shape[r].length; c++) {
        if (!shape[r][c]) continue;
        const ny = pos.y + r;
        const nx = pos.x + c;
        if (ny >= 0 && ny < ROWS && nx >= 0 && nx < COLS)
          displayGrid[ny][nx] = current;
      }
  }

  function renderMini(type: TetrominoType | null, size = 4) {
    if (!type)
      return (
        <div
          className="flex items-center justify-center"
          style={{ width: size * 18, height: size * 18 }}
        >
          <span className="text-[#4a4038] text-xs font-mono">—</span>
        </div>
      );
    const s = TETROMINOES[type];
    const rows = s.length;
    const cols = s[0].length;
    const cs = Math.min(18, Math.floor((size * 18) / Math.max(rows, cols)));
    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${cols}, ${cs}px)`,
          gap: 1,
        }}
      >
        {s.map((row, r) =>
          row.map((cell, c) => (
            <div
              key={`${r}-${c}`}
              style={{
                width: cs,
                height: cs,
                borderRadius: 2,
                backgroundColor: cell ? COLORS[type] : "transparent",
              }}
            />
          )),
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 pb-8 select-none">
      {/* Header */}
      <div className="w-full max-w-sm flex items-center justify-between">
        <span className="font-serif italic text-2xl text-[#111010]">
          Tetris
        </span>
        <div className="flex items-center gap-2">
          {started && !gameOver && (
            <button
              onClick={() => setPaused((p) => !p)}
              className="px-3 py-1.5 rounded-xl border border-[#e8e2d8] text-xs font-mono text-[#9a8f7e] hover:border-[#f97316] hover:text-[#f97316] transition-all"
            >
              {paused ? "▶ Resume" : "⏸ Pause"}
            </button>
          )}
          {started && (
            <button
              onClick={reset}
              className="px-3 py-1.5 rounded-xl border border-[#e8e2d8] text-xs font-mono text-[#9a8f7e] hover:border-[#f97316] hover:text-[#f97316] transition-all"
            >
              ↺ Restart
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-4 items-start">
        {/* Left panel */}
        <div className="flex flex-col gap-3 w-20">
          {/* Hold */}
          <div className="bg-white border border-[#f0ece8] rounded-2xl p-3 flex flex-col items-center gap-2">
            <p className="text-[9px] font-mono font-bold uppercase tracking-widest text-[#b09880]">
              Hold
            </p>
            {renderMini(held)}
          </div>
          {/* Score */}
          <div className="bg-white border border-[#f0ece8] rounded-2xl p-3 flex flex-col gap-2">
            <div>
              <p className="text-[9px] font-mono font-bold uppercase tracking-widest text-[#b09880]">
                Score
              </p>
              <p className="text-sm font-bold font-mono text-[#1a1208] tabular-nums">
                {score}
              </p>
            </div>
            <div>
              <p className="text-[9px] font-mono font-bold uppercase tracking-widest text-[#b09880]">
                Lines
              </p>
              <p className="text-sm font-bold font-mono text-[#1a1208]">
                {lines}
              </p>
            </div>
            <div>
              <p className="text-[9px] font-mono font-bold uppercase tracking-widest text-[#b09880]">
                Level
              </p>
              <p className="text-sm font-bold font-mono text-[#f97316]">
                {level}
              </p>
            </div>
          </div>
        </div>

        {/* Board */}
        <div
          className="relative border-2 border-[#e8e2d8] rounded-xl overflow-hidden"
          style={{
            width: COLS * CELL_SIZE,
            height: ROWS * CELL_SIZE,
            backgroundColor: "#faf8f5",
          }}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {/* Grid lines */}
          {Array.from({ length: ROWS }).map((_, r) =>
            Array.from({ length: COLS }).map((_, c) => (
              <div
                key={`${r}-${c}`}
                style={{
                  position: "absolute",
                  left: c * CELL_SIZE,
                  top: r * CELL_SIZE,
                  width: CELL_SIZE,
                  height: CELL_SIZE,
                  borderRight: "1px solid #f0ece8",
                  borderBottom: "1px solid #f0ece8",
                }}
              />
            )),
          )}

          {/* Cells */}
          {displayGrid.map((row, r) =>
            row.map((cell, c) => {
              if (!cell) return null;
              const isGhost = cell === "ghost";
              const color = isGhost
                ? COLORS[current]
                : COLORS[cell as TetrominoType];
              return (
                <div
                  key={`${r}-${c}`}
                  style={{
                    position: "absolute",
                    left: c * CELL_SIZE + 1,
                    top: r * CELL_SIZE + 1,
                    width: CELL_SIZE - 2,
                    height: CELL_SIZE - 2,
                    backgroundColor: isGhost ? "transparent" : color,
                    border: isGhost ? `2px solid ${color}` : "none",
                    borderRadius: 3,
                    opacity: isGhost ? 0.35 : 1,
                    boxShadow: isGhost
                      ? "none"
                      : `inset 0 2px 0 rgba(255,255,255,0.3), inset 0 -2px 0 rgba(0,0,0,0.2)`,
                  }}
                />
              );
            }),
          )}

          {/* Overlay: not started */}
          {!started && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#faf8f5]/95">
              <p className="font-serif italic text-2xl text-[#f97316] mb-2">
                Tetris
              </p>
              <p className="text-xs text-[#9a8f7e] font-mono mb-6 text-center px-4">
                ← → Move &nbsp;·&nbsp; ↑/X Rotate &nbsp;·&nbsp; ↓ Soft drop
                <br />
                Space Hard drop &nbsp;·&nbsp; C Hold &nbsp;·&nbsp; P Pause
              </p>
              <button
                onClick={reset}
                className="px-8 py-3 rounded-2xl bg-[#f97316] text-white font-bold text-sm hover:bg-[#c2500f] transition-all shadow-sm"
              >
                Start Game
              </button>
            </div>
          )}

          {/* Overlay: paused */}
          {paused && !gameOver && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#faf8f5]/95">
              <p className="font-serif italic text-2xl text-[#f97316] mb-4">
                Paused
              </p>
              <button
                onClick={() => setPaused(false)}
                className="px-8 py-3 rounded-2xl bg-[#f97316] text-white font-bold text-sm hover:bg-[#c2500f] transition-all"
              >
                ▶ Resume
              </button>
            </div>
          )}

          {/* Overlay: game over */}
          {gameOver && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#faf8f5]/95">
              <p className="font-serif italic text-2xl text-[#f97316] mb-1">
                Game Over
              </p>
              <p className="text-xs text-[#9a8f7e] font-mono mb-1">
                Score: {score}
              </p>
              <p className="text-xs text-[#9a8f7e] font-mono mb-6">
                Lines: {lines} &nbsp;·&nbsp; Level: {level}
              </p>
              <button
                onClick={reset}
                className="px-8 py-3 rounded-2xl bg-[#f97316] text-white font-bold text-sm hover:bg-[#c2500f] transition-all shadow-sm"
              >
                Play Again
              </button>
            </div>
          )}
        </div>

        {/* Right panel */}
        <div className="flex flex-col gap-3 w-20">
          {/* Next */}
          <div className="bg-white border border-[#f0ece8] rounded-2xl p-3 flex flex-col items-center gap-2">
            <p className="text-[9px] font-mono font-bold uppercase tracking-widest text-[#b09880]">
              Next
            </p>
            {renderMini(next)}
          </div>
          {/* Controls hint */}
          <div className="bg-white border border-[#f0ece8] rounded-2xl p-3">
            <p className="text-[9px] font-mono font-bold uppercase tracking-widest text-[#b09880] mb-2">
              Keys
            </p>
            {[
              ["←→", "Move"],
              ["↑/X", "Rotate"],
              ["↓", "Drop"],
              ["SPC", "Hard"],
              ["C", "Hold"],
              ["P", "Pause"],
            ].map(([key, label]) => (
              <div key={key} className="flex justify-between items-center mb-1">
                <span className="text-[8px] font-mono bg-[#f0ece8] rounded px-1 text-[#9a8f7e]">
                  {key}
                </span>
                <span className="text-[8px] font-mono text-[#c5bdb0]">
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Mobile controls */}
      <div className="flex flex-col items-center gap-2 mt-2 md:hidden">
        <div className="flex gap-3">
          <button
            onTouchStart={() => {
              const { grid, shape, pos } = stateRef.current;
              const np = { ...pos, x: pos.x - 1 };
              if (isValid(grid, shape, np)) setPos(np);
            }}
            className="w-14 h-14 rounded-2xl bg-white border border-[#e8e2d8] text-xl flex items-center justify-center text-[#9a8f7e] active:bg-[#f0ece8]"
          >
            ←
          </button>
          <button
            onTouchStart={() => {
              const { grid, shape, pos } = stateRef.current;
              const rotated = rotate(shape);
              const kicks = [0, -1, 1, -2, 2];
              for (const k of kicks) {
                const kp = { ...pos, x: pos.x + k };
                if (isValid(grid, rotated, kp)) {
                  setShape(rotated);
                  setPos(kp);
                  break;
                }
              }
            }}
            className="w-14 h-14 rounded-2xl bg-[#f97316] text-white text-sm font-bold flex items-center justify-center active:bg-[#c2500f]"
          >
            ↺
          </button>
          <button
            onTouchStart={() => {
              const { grid, shape, pos } = stateRef.current;
              const np = { ...pos, x: pos.x + 1 };
              if (isValid(grid, shape, np)) setPos(np);
            }}
            className="w-14 h-14 rounded-2xl bg-white border border-[#e8e2d8] text-xl flex items-center justify-center text-[#9a8f7e] active:bg-[#f0ece8]"
          >
            →
          </button>
        </div>
        <div className="flex gap-3">
          <button
            onTouchStart={() => {
              const { grid, shape, pos, current, next, held, canHold } =
                stateRef.current;
              if (!canHold) return;
              const spawnType = held ?? next;
              const newShape = TETROMINOES[spawnType];
              const spawnPos = {
                x: Math.floor((COLS - newShape[0].length) / 2),
                y: -1,
              };
              setHeld(current);
              setCurrent(spawnType);
              setShape(newShape);
              setPos(spawnPos);
              if (!held) setNext(randomTetromino());
              setCanHold(false);
            }}
            className="w-14 h-14 rounded-2xl bg-white border border-[#e8e2d8] text-xs font-bold flex items-center justify-center text-[#9a8f7e] active:bg-[#f0ece8]"
          >
            Hold
          </button>
          <button
            onTouchStart={() => {
              const { grid, shape, pos } = stateRef.current;
              let ghost = { ...pos };
              while (isValid(grid, shape, { ...ghost, y: ghost.y + 1 }))
                ghost.y++;
              setPos(ghost);
              setTimeout(() => lockPiece(), 0);
            }}
            className="w-14 h-14 rounded-2xl bg-[#1a1208] text-white text-xs font-bold flex items-center justify-center active:bg-[#2a2520]"
          >
            Drop
          </button>
          <button
            onTouchStart={() => moveDown()}
            className="w-14 h-14 rounded-2xl bg-white border border-[#e8e2d8] text-xl flex items-center justify-center text-[#9a8f7e] active:bg-[#f0ece8]"
          >
            ↓
          </button>
        </div>
      </div>
    </div>
  );
}
