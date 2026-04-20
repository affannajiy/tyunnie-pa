"use client";

import { useState, useEffect } from "react";

// ── Math helpers ──────────────────────────────────────────────────────────

function factorial(n: number): number {
  if (!Number.isInteger(n) || n < 0) return NaN;
  if (n > 170) return Infinity;
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

function nCr(n: number, r: number): number {
  if (!Number.isInteger(n) || !Number.isInteger(r) || r < 0 || r > n) return NaN;
  return factorial(n) / (factorial(r) * factorial(n - r));
}

function nPr(n: number, r: number): number {
  if (!Number.isInteger(n) || !Number.isInteger(r) || r < 0 || r > n) return NaN;
  return factorial(n) / factorial(n - r);
}

function formatResult(n: number): string {
  if (isNaN(n)) return "Math Error";
  if (!isFinite(n)) return n > 0 ? "+∞" : "-∞";
  const abs = Math.abs(n);
  if (abs !== 0 && (abs >= 1e10 || abs < 1e-7)) {
    const e = n.toExponential(6);
    const [m, x] = e.split("e");
    return `${parseFloat(m)}×10^${parseInt(x)}`;
  }
  return parseFloat(n.toPrecision(10)).toString();
}

function buildEval(
  expr: string,
  mode: "DEG" | "RAD",
  memory: number,
  ans: number
): string {
  let e = expr.trim();
  e = e.replace(/\bAns\b/g, `(${ans})`);
  e = e.replace(/\bMem\b/g, `(${memory})`);
  e = e.replace(/×/g, "*").replace(/÷/g, "/");
  e = e.replace(/π/g, "(Math.PI)");
  e = e.replace(/ℯ(?!\^)/g, "(Math.E)");   // bare ℯ constant
  e = e.replace(/ℯ\^/g, "(Math.E)**");     // ℯ^( → (Math.E)**(
  e = e.replace(/(\d+(?:\.\d+)?)\s*!/g, (_, n) => `factorial(${n})`);
  e = e.replace(/\^/g, "**");
  const toRad = mode === "DEG" ? "(Math.PI/180)*" : "";
  const fromRad = mode === "DEG" ? "(180/Math.PI)*" : "";
  e = e.replace(/\basinh\(/g, "Math.asinh(");
  e = e.replace(/\bacosh\(/g, "Math.acosh(");
  e = e.replace(/\batanh\(/g, "Math.atanh(");
  e = e.replace(/\basin\(/g, `${fromRad}Math.asin(`);
  e = e.replace(/\bacos\(/g, `${fromRad}Math.acos(`);
  e = e.replace(/\batan\(/g, `${fromRad}Math.atan(`);
  e = e.replace(/\bsinh\(/g, "Math.sinh(");
  e = e.replace(/\bcosh\(/g, "Math.cosh(");
  e = e.replace(/\btanh\(/g, "Math.tanh(");
  e = e.replace(/\bsin\(/g, `Math.sin(${toRad}`);
  e = e.replace(/\bcos\(/g, `Math.cos(${toRad}`);
  e = e.replace(/\btan\(/g, `Math.tan(${toRad}`);
  e = e.replace(/\blog\(/g, "Math.log10(");
  e = e.replace(/\bln\(/g, "Math.log(");
  e = e.replace(/√\(/g, "Math.sqrt(");
  e = e.replace(/∛\(/g, "Math.cbrt(");
  e = e.replace(/\babs\(/g, "Math.abs(");
  e = e.replace(/\bnCr\(/g, "nCr(");
  e = e.replace(/\bnPr\(/g, "nPr(");
  // Implicit multiplication: 2( → 2*( etc.
  e = e.replace(/(\d)\s*\(/g, "$1*(");
  e = e.replace(/(\d)\s*(Math\.)/g, "$1*$2");
  e = e.replace(/\)\s*(\d)/g, ")*$1");
  e = e.replace(/\)\s*\(/g, ")*(");
  e = e.replace(/\)\s*(Math\.)/g, ")*$1");
  return e;
}

function tryEval(
  expr: string,
  mode: "DEG" | "RAD",
  memory: number,
  ans: number
): number | null {
  try {
    const e = buildEval(expr, mode, memory, ans);
    if (!e) return null;
    // eslint-disable-next-line no-new-func
    const v = new Function(
      "Math", "factorial", "nCr", "nPr",
      `"use strict"; return (${e});`
    )(Math, factorial, nCr, nPr);
    return typeof v === "number" ? v : null;
  } catch {
    return null;
  }
}

// ── Button layout ─────────────────────────────────────────────────────────

interface Btn {
  id: string;
  label: string;
  sub?: string;    // SHIFT secondary label shown above
  wide?: boolean;  // col-span-2
}

const ROWS: Btn[][] = [
  // Row 1 — utility
  [
    { id: "SHIFT",  label: "SHIFT" },
    { id: "MODE",   label: "DEG" },
    { id: "lp",     label: "(" },
    { id: "rp",     label: ")" },
    { id: "AC",     label: "AC" },
  ],
  // Row 2 — trig
  [
    { id: "sin",   label: "sin",  sub: "sin⁻¹" },
    { id: "cos",   label: "cos",  sub: "cos⁻¹" },
    { id: "tan",   label: "tan",  sub: "tan⁻¹" },
    { id: "log",   label: "log",  sub: "10ˣ" },
    { id: "ln",    label: "ln",   sub: "eˣ" },
  ],
  // Row 3 — hyp trig
  [
    { id: "sinh",  label: "sinh", sub: "sinh⁻¹" },
    { id: "cosh",  label: "cosh", sub: "cosh⁻¹" },
    { id: "tanh",  label: "tanh", sub: "tanh⁻¹" },
    { id: "abs",   label: "|x|" },
    { id: "pct",   label: "%" },
  ],
  // Row 4 — powers & consts
  [
    { id: "sq",    label: "x²",   sub: "x³" },
    { id: "sqrt",  label: "√",    sub: "∛" },
    { id: "pow",   label: "xʸ",   sub: "ˣ√" },
    { id: "pi",    label: "π" },
    { id: "euler", label: "ℯ" },
  ],
  // Row 5 — combinatorics / memory
  [
    { id: "fact",  label: "n!" },
    { id: "nCr",   label: "nCr" },
    { id: "nPr",   label: "nPr" },
    { id: "MC",    label: "MC" },
    { id: "MR",    label: "MR" },
  ],
  // Row 6 — M± / EXP
  [
    { id: "Mpl",   label: "M+" },
    { id: "Mmi",   label: "M−" },
    { id: "exp10", label: "EXP" },
    { id: "DEL",   label: "⌫" },
    { id: "div",   label: "÷" },
  ],
  // Row 7 — 7 8 9
  [
    { id: "7",     label: "7" },
    { id: "8",     label: "8" },
    { id: "9",     label: "9" },
    { id: "mul",   label: "×" },
    { id: "minus", label: "−" },
  ],
  // Row 8 — 4 5 6
  [
    { id: "4",     label: "4" },
    { id: "5",     label: "5" },
    { id: "6",     label: "6" },
    { id: "plus",  label: "+" },
    { id: "ANS",   label: "ANS" },
  ],
  // Row 9 — 1 2 3
  [
    { id: "1",     label: "1" },
    { id: "2",     label: "2" },
    { id: "3",     label: "3" },
    { id: "comma", label: "," },
    { id: "EQ",    label: "=" },
  ],
  // Row 10 — 0 . EXP
  [
    { id: "0",     label: "0", wide: true },
    { id: "dot",   label: "." },
    { id: "neg",   label: "(−)" },
    { id: "EQ2",   label: "=" },
  ],
];

// ── Component ─────────────────────────────────────────────────────────────

export default function Calculator() {
  const [expr, setExpr]         = useState("");
  const [ans, setAns]           = useState(0);
  const [memory, setMemory]     = useState(0);
  const [mode, setMode]         = useState<"DEG" | "RAD">("DEG");
  const [shift, setShift]       = useState(false);
  const [justCalced, setJustCalced] = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const liveResult = !error && expr ? tryEval(expr, mode, memory, ans) : null;

  // ── Append helper ──────────────────────────────────────────────────────

  function append(token: string) {
    setError(null);
    if (justCalced) {
      // Continue from ans if operator, otherwise start fresh
      setExpr(/^[+\-×÷^]$/.test(token) ? `Ans${token}` : token);
      setJustCalced(false);
    } else {
      setExpr(prev => prev + token);
    }
  }

  // ── Button handler ─────────────────────────────────────────────────────

  function handleBtn(id: string) {
    const s = shift;
    if (id !== "SHIFT") setShift(false);

    if (id === "SHIFT") { setShift(v => !v); return; }

    if (id === "MODE") { setMode(m => m === "DEG" ? "RAD" : "DEG"); return; }

    if (id === "AC") {
      setExpr(""); setJustCalced(false); setError(null); return;
    }

    if (id === "DEL") {
      if (justCalced) { setExpr(""); setJustCalced(false); return; }
      setExpr(prev => {
        const multi = /(sin\(|cos\(|tan\(|asin\(|acos\(|atan\(|sinh\(|cosh\(|tanh\(|asinh\(|acosh\(|atanh\(|log\(|ln\(|√\(|∛\(|abs\(|nCr\(|nPr\(|×10\^\(|Ans|Mem)$/;
        const m = prev.match(multi);
        return m ? prev.slice(0, -m[0].length) : prev.slice(0, -1);
      });
      return;
    }

    if (id === "EQ" || id === "EQ2") {
      const src = justCalced ? "Ans" : expr;
      if (!src) return;
      const r = tryEval(src, mode, memory, ans);
      if (r === null || isNaN(r)) {
        setError("Math Error"); setJustCalced(false);
      } else {
        setAns(r); setJustCalced(true); setError(null);
      }
      return;
    }

    if (id === "ANS")   { append("Ans"); return; }
    if (id === "MC")    { setMemory(0); return; }
    if (id === "MR")    { append("Mem"); return; }
    if (id === "Mpl") {
      const cur = justCalced ? ans : (tryEval(expr, mode, memory, ans) ?? 0);
      setMemory(m => m + cur); return;
    }
    if (id === "Mmi") {
      const cur = justCalced ? ans : (tryEval(expr, mode, memory, ans) ?? 0);
      setMemory(m => m - cur); return;
    }

    if (id === "sin")   { append(s ? "asin("  : "sin(");  return; }
    if (id === "cos")   { append(s ? "acos("  : "cos(");  return; }
    if (id === "tan")   { append(s ? "atan("  : "tan(");  return; }
    if (id === "sinh")  { append(s ? "asinh(" : "sinh("); return; }
    if (id === "cosh")  { append(s ? "acosh(" : "cosh("); return; }
    if (id === "tanh")  { append(s ? "atanh(" : "tanh("); return; }
    if (id === "log")   { append(s ? "10^("   : "log(");  return; }
    if (id === "ln")    { append(s ? "ℯ^("    : "ln(");   return; }

    if (id === "sq")    { append(s ? "^3" : "^2");  return; }
    if (id === "sqrt")  { append(s ? "∛(" : "√(");  return; }
    if (id === "pow")   { append(s ? "^(1/" : "^("); return; }

    if (id === "pi")    { append("π");     return; }
    if (id === "euler") { append("ℯ");     return; }
    if (id === "abs")   { append("abs(");  return; }
    if (id === "fact")  { append("!");     return; }
    if (id === "nCr")   { append("nCr(");  return; }
    if (id === "nPr")   { append("nPr(");  return; }
    if (id === "pct")   { append("/100");  return; }
    if (id === "exp10") { append("×10^("); return; }
    if (id === "neg")   { append("(-1)×"); return; }
    if (id === "lp")    { append("(");     return; }
    if (id === "rp")    { append(")");     return; }
    if (id === "comma") { append(",");     return; }
    if (id === "dot")   { append(".");     return; }
    if (id === "plus")  { append("+");     return; }
    if (id === "minus") { append("-");     return; }
    if (id === "mul")   { append("×");     return; }
    if (id === "div")   { append("÷");     return; }

    // digits
    if (/^\d\d?$/.test(id)) { append(id); return; }
  }

  // ── Keyboard ──────────────────────────────────────────────────────────

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const k = e.key;
      const map: Record<string, string> = {
        "0": "0", "1": "1", "2": "2", "3": "3", "4": "4",
        "5": "5", "6": "6", "7": "7", "8": "8", "9": "9",
        ".": "dot", ",": "comma",
        "+": "plus", "-": "minus", "*": "mul", "/": "div",
        "^": "pow",
        "(": "lp", ")": "rp",
        "Enter": "EQ", "=": "EQ",
        "Backspace": "DEL", "Escape": "AC",
        "%": "pct",
      };
      const btnId = map[k];
      if (btnId) { e.preventDefault(); handleBtn(btnId); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expr, shift, justCalced, ans, memory, mode, error]);

  // ── Styles ────────────────────────────────────────────────────────────

  function btnClass(id: string): string {
    const base = "relative flex flex-col items-center justify-center rounded-xl active:scale-95 transition-all duration-75 select-none cursor-pointer font-mono leading-none min-h-[38px] ";
    if (id === "EQ" || id === "EQ2")
      return base + "bg-[var(--accent)] text-white text-lg font-bold shadow-lg shadow-[rgba(var(--accent-rgb),0.4)]";
    if (id === "AC")
      return base + "bg-[#3a1010] text-[#f87171] font-bold text-sm";
    if (id === "DEL")
      return base + "bg-[#2a1e0e] text-[#fbbf24] text-sm";
    if (id === "SHIFT")
      return base + (shift
        ? "bg-[var(--accent)] text-white font-bold text-xs shadow-sm shadow-[rgba(var(--accent-rgb),0.5)]"
        : "bg-[#2a2218] text-[#f5a050] text-xs");
    if (id === "MODE")
      return base + "bg-[#1c2235] text-[#93c5fd] text-xs font-bold";
    if (["MC","MR","Mpl","Mmi"].includes(id))
      return base + "bg-[#0b2016] text-[#4ade80] text-xs";
    if (["sin","cos","tan","sinh","cosh","tanh","log","ln"].includes(id))
      return base + "bg-[#151e30] text-[#93c5fd] text-xs";
    if (["sq","sqrt","pow","pi","euler","fact","nCr","nPr","abs","pct"].includes(id))
      return base + "bg-[#151e30] text-[#c4b5fd] text-xs";
    if (["plus","minus","mul","div"].includes(id))
      return base + "bg-[#2a1e10] text-[var(--accent)] text-lg font-bold";
    if (["lp","rp","comma","neg","exp10","ANS"].includes(id))
      return base + "bg-[#1e1c18] text-[#c5b8a8] text-xs";
    return base + "bg-[#252018] text-[#f5f0e8] text-lg font-bold";
  }

  // ── Render ────────────────────────────────────────────────────────────

  const displayExpr = error
    ? error
    : justCalced
    ? formatResult(ans)
    : expr || "0";

  const previewResult =
    !error && !justCalced && expr && liveResult !== null
      ? formatResult(liveResult)
      : null;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="mb-4 shrink-0">
        <h1 className="font-serif italic text-2xl text-[#111010] dark:text-[#e8ddd0] mb-0.5">
          Calculator
        </h1>
        <p className="text-xs text-[#9a8f7e]">Scientific · fx-570 style</p>
      </div>

      {/* Calculator body */}
      <div
        className="flex flex-col flex-1 min-h-0 rounded-3xl overflow-hidden shadow-2xl mx-auto w-full"
        style={{ maxWidth: 400, background: "#0f0d0a" }}
      >
        {/* ── Display ── */}
        <div
          className="shrink-0 px-5 pt-5 pb-4 flex flex-col gap-1.5"
          style={{ background: "#0a0807", borderBottom: "1px solid #1e1a16" }}
        >
          {/* Indicators */}
          <div className="flex items-center gap-1.5 h-5">
            <span
              className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded"
              style={{
                background: mode === "DEG" ? "rgba(249,115,22,0.18)" : "rgba(96,165,250,0.18)",
                color: mode === "DEG" ? "var(--accent)" : "#93c5fd",
              }}
            >
              {mode}
            </span>
            {shift && (
              <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400">
                SHIFT
              </span>
            )}
            {memory !== 0 && (
              <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-green-500/20 text-green-400">
                M
              </span>
            )}
          </div>

          {/* Expression */}
          <div
            className="text-right font-mono text-sm min-h-[22px] break-all leading-snug"
            style={{ color: error ? "#f87171" : justCalced ? "#7a6a56" : "#b8a896" }}
          >
            {displayExpr}
          </div>

          {/* Live preview / result */}
          <div className="text-right font-mono font-bold min-h-[40px] flex items-end justify-end">
            {justCalced ? (
              <span className="text-[#f5f0e8]" style={{ fontSize: "clamp(20px, 5vw, 32px)" }}>
                {formatResult(ans)}
              </span>
            ) : previewResult ? (
              <span className="text-[#6a5a4a]" style={{ fontSize: "clamp(18px, 4vw, 28px)" }}>
                {previewResult}
              </span>
            ) : (
              <span className="text-[#2a2418]" style={{ fontSize: "clamp(20px, 5vw, 32px)" }}>0</span>
            )}
          </div>
        </div>

        {/* ── Buttons ── */}
        <div className="flex-1 min-h-0 flex flex-col gap-[2px] p-2 overflow-hidden" style={{ background: "#0d0b09" }}>
          {ROWS.map((row, ri) => (
            <div key={ri} className="flex gap-[2px] flex-1 min-h-0">
              {row.map(btn => (
                <button
                  key={btn.id}
                  onClick={() => handleBtn(btn.id)}
                  className={btnClass(btn.id) + (btn.wide ? " flex-[2]" : " flex-1")}
                >
                  {/* SHIFT secondary label */}
                  {btn.sub && (
                    <span
                      className="absolute top-[3px] text-[7px] font-bold leading-none"
                      style={{ color: shift ? "#fde68a" : "#4a4030", transition: "color 0.15s" }}
                    >
                      {btn.sub}
                    </span>
                  )}
                  {/* Main label */}
                  <span>
                    {btn.id === "MODE" ? mode : btn.label}
                  </span>
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
