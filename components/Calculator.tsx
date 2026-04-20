"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  differenceInDays,
  differenceInCalendarMonths,
  differenceInCalendarYears,
  addDays,
  addMonths,
  addYears,
  format,
} from "date-fns";

// ─────────────────────────────────────────────────────────────────────────────
// Scientific helpers
// ─────────────────────────────────────────────────────────────────────────────

function factorial(n: number): number {
  if (!Number.isInteger(n) || n < 0) return NaN;
  if (n > 170) return Infinity;
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

function nCr(n: number, r: number): number {
  if (!Number.isInteger(n) || !Number.isInteger(r) || r < 0 || r > n)
    return NaN;
  return factorial(n) / (factorial(r) * factorial(n - r));
}

function nPr(n: number, r: number): number {
  if (!Number.isInteger(n) || !Number.isInteger(r) || r < 0 || r > n)
    return NaN;
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
  ans: number,
): string {
  let e = expr.trim();
  e = e.replace(/\bAns\b/g, `(${ans})`);
  e = e.replace(/\bMem\b/g, `(${memory})`);
  e = e.replace(/×/g, "*").replace(/÷/g, "/");
  e = e.replace(/π/g, "(Math.PI)");
  e = e.replace(/ℯ(?!\^)/g, "(Math.E)");
  e = e.replace(/ℯ\^/g, "(Math.E)**");
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
  ans: number,
): number | null {
  try {
    const e = buildEval(expr, mode, memory, ans);
    if (!e) return null;
    // eslint-disable-next-line no-new-func
    const v = new Function(
      "Math",
      "factorial",
      "nCr",
      "nPr",
      `"use strict"; return (${e});`,
    )(Math, factorial, nCr, nPr);
    return typeof v === "number" ? v : null;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Scientific button layout
// ─────────────────────────────────────────────────────────────────────────────

interface Btn {
  id: string;
  label: string;
  sub?: string;
  wide?: boolean;
}

const ROWS: Btn[][] = [
  [
    { id: "SHIFT", label: "SHIFT" },
    { id: "MODE", label: "DEG" },
    { id: "lp", label: "(" },
    { id: "rp", label: ")" },
    { id: "AC", label: "AC" },
  ],
  [
    { id: "sin", label: "sin", sub: "sin⁻¹" },
    { id: "cos", label: "cos", sub: "cos⁻¹" },
    { id: "tan", label: "tan", sub: "tan⁻¹" },
    { id: "log", label: "log", sub: "10ˣ" },
    { id: "ln", label: "ln", sub: "eˣ" },
  ],
  [
    { id: "sinh", label: "sinh", sub: "sinh⁻¹" },
    { id: "cosh", label: "cosh", sub: "cosh⁻¹" },
    { id: "tanh", label: "tanh", sub: "tanh⁻¹" },
    { id: "abs", label: "|x|" },
    { id: "pct", label: "%" },
  ],
  [
    { id: "sq", label: "x²", sub: "x³" },
    { id: "sqrt", label: "√", sub: "∛" },
    { id: "pow", label: "xʸ", sub: "ˣ√" },
    { id: "pi", label: "π" },
    { id: "euler", label: "ℯ" },
  ],
  [
    { id: "fact", label: "n!" },
    { id: "nCr", label: "nCr" },
    { id: "nPr", label: "nPr" },
    { id: "MC", label: "MC" },
    { id: "MR", label: "MR" },
  ],
  [
    { id: "Mpl", label: "M+" },
    { id: "Mmi", label: "M−" },
    { id: "exp10", label: "EXP" },
    { id: "DEL", label: "⌫" },
    { id: "div", label: "÷" },
  ],
  [
    { id: "7", label: "7" },
    { id: "8", label: "8" },
    { id: "9", label: "9" },
    { id: "mul", label: "×" },
    { id: "minus", label: "−" },
  ],
  [
    { id: "4", label: "4" },
    { id: "5", label: "5" },
    { id: "6", label: "6" },
    { id: "plus", label: "+" },
    { id: "ANS", label: "ANS" },
  ],
  [
    { id: "1", label: "1" },
    { id: "2", label: "2" },
    { id: "3", label: "3" },
    { id: "comma", label: "," },
    { id: "EQ", label: "=" },
  ],
  [
    { id: "0", label: "0", wide: true },
    { id: "dot", label: "." },
    { id: "neg", label: "(−)" },
  ],
];

// ─────────────────────────────────────────────────────────────────────────────
// Graphing types + helpers
// ─────────────────────────────────────────────────────────────────────────────

const GRAPH_COLORS = [
  "var(--accent)",
  "#3b82f6",
  "#22c55e",
  "#f59e0b",
  "#ec4899",
] as const;

interface GraphFn {
  expr: string;
  color: string;
  error: string | null;
}

// Allowed chars for graphing expressions
const GRAPH_SAFE = /^[0-9x+\-*/^().sincostanlgoqrtebsπ\s]+$/i;

function sanitizeGraphExpr(raw: string): string | null {
  if (!GRAPH_SAFE.test(raw)) return null;
  let e = raw.trim();
  e = e.replace(/\^/g, "**");
  e = e.replace(/\bπ\b/g, "Math.PI");
  e = e.replace(/\be\b/g, "Math.E");
  e = e.replace(/\bsin\b/g, "Math.sin");
  e = e.replace(/\bcos\b/g, "Math.cos");
  e = e.replace(/\btan\b/g, "Math.tan");
  e = e.replace(/\babs\b/g, "Math.abs");
  e = e.replace(/\bsqrt\b/g, "Math.sqrt");
  e = e.replace(/\blog\b/g, "Math.log10");
  e = e.replace(/\bln\b/g, "Math.log");
  // implicit multiply: 2x → 2*x, 2( → 2*(
  e = e.replace(/(\d)(x)/g, "$1*$2");
  e = e.replace(/(\d)\s*\(/g, "$1*(");
  return e;
}

function evalGraphFn(sanitized: string, x: number): number {
  // eslint-disable-next-line no-new-func
  return new Function("x", "Math", `"use strict"; return (${sanitized});`)(
    x,
    Math,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Converter data
// ─────────────────────────────────────────────────────────────────────────────

type ConvCategory =
  | "Length"
  | "Weight"
  | "Temperature"
  | "Area"
  | "Volume"
  | "Speed"
  | "Currency";

interface ConvUnit {
  label: string;
  toBase: (v: number) => number;
  fromBase: (v: number) => number;
}

const CONV_UNITS: Record<ConvCategory, ConvUnit[]> = {
  Length: [
    { label: "mm", toBase: (v) => v / 1000, fromBase: (v) => v * 1000 },
    { label: "cm", toBase: (v) => v / 100, fromBase: (v) => v * 100 },
    { label: "m", toBase: (v) => v, fromBase: (v) => v },
    { label: "km", toBase: (v) => v * 1000, fromBase: (v) => v / 1000 },
    { label: "in", toBase: (v) => v * 0.0254, fromBase: (v) => v / 0.0254 },
    { label: "ft", toBase: (v) => v * 0.3048, fromBase: (v) => v / 0.3048 },
    { label: "yd", toBase: (v) => v * 0.9144, fromBase: (v) => v / 0.9144 },
    { label: "mi", toBase: (v) => v * 1609.344, fromBase: (v) => v / 1609.344 },
  ],
  Weight: [
    { label: "mg", toBase: (v) => v / 1e6, fromBase: (v) => v * 1e6 },
    { label: "g", toBase: (v) => v / 1000, fromBase: (v) => v * 1000 },
    { label: "kg", toBase: (v) => v, fromBase: (v) => v },
    { label: "t", toBase: (v) => v * 1000, fromBase: (v) => v / 1000 },
    {
      label: "oz",
      toBase: (v) => v * 0.0283495,
      fromBase: (v) => v / 0.0283495,
    },
    { label: "lb", toBase: (v) => v * 0.453592, fromBase: (v) => v / 0.453592 },
  ],
  Temperature: [
    { label: "°C", toBase: (v) => v, fromBase: (v) => v },
    {
      label: "°F",
      toBase: (v) => ((v - 32) * 5) / 9,
      fromBase: (v) => (v * 9) / 5 + 32,
    },
    { label: "K", toBase: (v) => v - 273.15, fromBase: (v) => v + 273.15 },
  ],
  Area: [
    { label: "cm²", toBase: (v) => v / 10000, fromBase: (v) => v * 10000 },
    { label: "m²", toBase: (v) => v, fromBase: (v) => v },
    { label: "km²", toBase: (v) => v * 1e6, fromBase: (v) => v / 1e6 },
    {
      label: "in²",
      toBase: (v) => v * 0.00064516,
      fromBase: (v) => v / 0.00064516,
    },
    {
      label: "ft²",
      toBase: (v) => v * 0.092903,
      fromBase: (v) => v / 0.092903,
    },
    { label: "acre", toBase: (v) => v * 4046.86, fromBase: (v) => v / 4046.86 },
    { label: "ha", toBase: (v) => v * 10000, fromBase: (v) => v / 10000 },
  ],
  Volume: [
    { label: "mL", toBase: (v) => v / 1000, fromBase: (v) => v * 1000 },
    { label: "L", toBase: (v) => v, fromBase: (v) => v },
    { label: "m³", toBase: (v) => v * 1000, fromBase: (v) => v / 1000 },
    {
      label: "tsp",
      toBase: (v) => v * 0.00492892,
      fromBase: (v) => v / 0.00492892,
    },
    {
      label: "tbsp",
      toBase: (v) => v * 0.0147868,
      fromBase: (v) => v / 0.0147868,
    },
    {
      label: "fl oz",
      toBase: (v) => v * 0.0295735,
      fromBase: (v) => v / 0.0295735,
    },
    {
      label: "cup",
      toBase: (v) => v * 0.236588,
      fromBase: (v) => v / 0.236588,
    },
    { label: "pt", toBase: (v) => v * 0.473176, fromBase: (v) => v / 0.473176 },
    { label: "qt", toBase: (v) => v * 0.946353, fromBase: (v) => v / 0.946353 },
    { label: "gal", toBase: (v) => v * 3.78541, fromBase: (v) => v / 3.78541 },
  ],
  Speed: [
    { label: "m/s", toBase: (v) => v, fromBase: (v) => v },
    { label: "km/h", toBase: (v) => v / 3.6, fromBase: (v) => v * 3.6 },
    { label: "mph", toBase: (v) => v * 0.44704, fromBase: (v) => v / 0.44704 },
    {
      label: "knot",
      toBase: (v) => v * 0.514444,
      fromBase: (v) => v / 0.514444,
    },
  ],
  Currency: [
    // Rates relative to USD (approximate, not live)
    { label: "USD", toBase: (v) => v, fromBase: (v) => v },
    { label: "EUR", toBase: (v) => v / 0.92, fromBase: (v) => v * 0.92 },
    { label: "GBP", toBase: (v) => v / 0.79, fromBase: (v) => v * 0.79 },
    { label: "JPY", toBase: (v) => v / 149.5, fromBase: (v) => v * 149.5 },
    { label: "MYR", toBase: (v) => v / 4.71, fromBase: (v) => v * 4.71 },
    { label: "AUD", toBase: (v) => v / 1.53, fromBase: (v) => v * 1.53 },
    { label: "CAD", toBase: (v) => v / 1.36, fromBase: (v) => v * 1.36 },
    { label: "CNY", toBase: (v) => v / 7.24, fromBase: (v) => v * 7.24 },
  ],
};

const CONV_CATEGORIES = Object.keys(CONV_UNITS) as ConvCategory[];

// ─────────────────────────────────────────────────────────────────────────────
// Mode type
// ─────────────────────────────────────────────────────────────────────────────

type CalcMode = "Scientific" | "Graphing" | "Converter" | "Date";
const MODES: CalcMode[] = ["Scientific", "Graphing", "Converter", "Date"];

// ─────────────────────────────────────────────────────────────────────────────
// ScientificCalc sub-component
// ─────────────────────────────────────────────────────────────────────────────

function ScientificCalc() {
  const [expr, setExpr] = useState("");
  const [ans, setAns] = useState(0);
  const [memory, setMemory] = useState(0);
  const [mode, setMode] = useState<"DEG" | "RAD">("DEG");
  const [shift, setShift] = useState(false);
  const [justCalced, setJustCalced] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const liveResult = !error && expr ? tryEval(expr, mode, memory, ans) : null;

  function append(token: string) {
    setError(null);
    if (justCalced) {
      setExpr(/^[+\-×÷^]$/.test(token) ? `Ans${token}` : token);
      setJustCalced(false);
    } else {
      setExpr((prev) => prev + token);
    }
  }

  function handleBtn(id: string) {
    const s = shift;
    if (id !== "SHIFT") setShift(false);

    if (id === "SHIFT") {
      setShift((v) => !v);
      return;
    }
    if (id === "MODE") {
      setMode((m) => (m === "DEG" ? "RAD" : "DEG"));
      return;
    }
    if (id === "AC") {
      setExpr("");
      setJustCalced(false);
      setError(null);
      return;
    }

    if (id === "DEL") {
      if (justCalced) {
        setExpr("");
        setJustCalced(false);
        return;
      }
      setExpr((prev) => {
        const multi =
          /(sin\(|cos\(|tan\(|asin\(|acos\(|atan\(|sinh\(|cosh\(|tanh\(|asinh\(|acosh\(|atanh\(|log\(|ln\(|√\(|∛\(|abs\(|nCr\(|nPr\(|×10\^\(|Ans|Mem)$/;
        const m = prev.match(multi);
        return m ? prev.slice(0, -m[0].length) : prev.slice(0, -1);
      });
      return;
    }

    if (id === "EQ") {
      const src = justCalced ? "Ans" : expr;
      if (!src) return;
      const r = tryEval(src, mode, memory, ans);
      if (r === null || isNaN(r)) {
        setError("Math Error");
        setJustCalced(false);
      } else {
        setAns(r);
        setJustCalced(true);
        setError(null);
      }
      return;
    }

    if (id === "ANS") {
      append("Ans");
      return;
    }
    if (id === "MC") {
      setMemory(0);
      return;
    }
    if (id === "MR") {
      append("Mem");
      return;
    }
    if (id === "Mpl") {
      const cur = justCalced ? ans : (tryEval(expr, mode, memory, ans) ?? 0);
      setMemory((m) => m + cur);
      return;
    }
    if (id === "Mmi") {
      const cur = justCalced ? ans : (tryEval(expr, mode, memory, ans) ?? 0);
      setMemory((m) => m - cur);
      return;
    }

    if (id === "sin") {
      append(s ? "asin(" : "sin(");
      return;
    }
    if (id === "cos") {
      append(s ? "acos(" : "cos(");
      return;
    }
    if (id === "tan") {
      append(s ? "atan(" : "tan(");
      return;
    }
    if (id === "sinh") {
      append(s ? "asinh(" : "sinh(");
      return;
    }
    if (id === "cosh") {
      append(s ? "acosh(" : "cosh(");
      return;
    }
    if (id === "tanh") {
      append(s ? "atanh(" : "tanh(");
      return;
    }
    if (id === "log") {
      append(s ? "10^(" : "log(");
      return;
    }
    if (id === "ln") {
      append(s ? "ℯ^(" : "ln(");
      return;
    }
    if (id === "sq") {
      append(s ? "^3" : "^2");
      return;
    }
    if (id === "sqrt") {
      append(s ? "∛(" : "√(");
      return;
    }
    if (id === "pow") {
      append(s ? "^(1/" : "^(");
      return;
    }
    if (id === "pi") {
      append("π");
      return;
    }
    if (id === "euler") {
      append("ℯ");
      return;
    }
    if (id === "abs") {
      append("abs(");
      return;
    }
    if (id === "fact") {
      append("!");
      return;
    }
    if (id === "nCr") {
      append("nCr(");
      return;
    }
    if (id === "nPr") {
      append("nPr(");
      return;
    }
    if (id === "pct") {
      append("/100");
      return;
    }
    if (id === "exp10") {
      append("×10^(");
      return;
    }
    if (id === "neg") {
      append("(-1)×");
      return;
    }
    if (id === "lp") {
      append("(");
      return;
    }
    if (id === "rp") {
      append(")");
      return;
    }
    if (id === "comma") {
      append(",");
      return;
    }
    if (id === "dot") {
      append(".");
      return;
    }
    if (id === "plus") {
      append("+");
      return;
    }
    if (id === "minus") {
      append("-");
      return;
    }
    if (id === "mul") {
      append("×");
      return;
    }
    if (id === "div") {
      append("÷");
      return;
    }
    if (/^\d\d?$/.test(id)) {
      append(id);
      return;
    }
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const k = e.key;
      const map: Record<string, string> = {
        "0": "0",
        "1": "1",
        "2": "2",
        "3": "3",
        "4": "4",
        "5": "5",
        "6": "6",
        "7": "7",
        "8": "8",
        "9": "9",
        ".": "dot",
        ",": "comma",
        "+": "plus",
        "-": "minus",
        "*": "mul",
        "/": "div",
        "^": "pow",
        "(": "lp",
        ")": "rp",
        Enter: "EQ",
        "=": "EQ",
        Backspace: "DEL",
        Escape: "AC",
        "%": "pct",
      };
      const btnId = map[k];
      if (btnId) {
        e.preventDefault();
        handleBtn(btnId);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expr, shift, justCalced, ans, memory, mode, error]);

  function btnClass(id: string): string {
    const base =
      "relative flex flex-col items-center justify-center rounded-xl active:scale-95 transition-all duration-75 select-none cursor-pointer font-mono leading-none min-h-[38px] ";
    if (id === "EQ")
      return (
        base +
        "bg-[var(--accent)] text-white text-lg font-bold shadow-lg shadow-[rgba(var(--accent-rgb),0.4)]"
      );
    if (id === "AC")
      return (
        base +
        "bg-red-100 dark:bg-[#3a1010] text-red-500 dark:text-[#f87171] font-bold text-sm"
      );
    if (id === "DEL")
      return (
        base +
        "bg-amber-50 dark:bg-[#2a1e0e] text-amber-500 dark:text-[#fbbf24] text-sm"
      );
    if (id === "SHIFT")
      return (
        base +
        (shift
          ? "bg-[var(--accent)] text-white font-bold text-xs shadow-sm shadow-[rgba(var(--accent-rgb),0.5)]"
          : "bg-orange-50 dark:bg-[#2a2218] text-[var(--accent)] text-xs")
      );
    if (id === "MODE")
      return (
        base +
        "bg-blue-50 dark:bg-[#1c2235] text-blue-500 dark:text-[#93c5fd] text-xs font-bold"
      );
    if (["MC", "MR", "Mpl", "Mmi"].includes(id))
      return (
        base +
        "bg-green-50 dark:bg-[#0b2016] text-green-600 dark:text-[#4ade80] text-xs"
      );
    if (["sin", "cos", "tan", "sinh", "cosh", "tanh", "log", "ln"].includes(id))
      return (
        base +
        "bg-blue-50 dark:bg-[#151e30] text-blue-500 dark:text-[#93c5fd] text-xs"
      );
    if (
      [
        "sq",
        "sqrt",
        "pow",
        "pi",
        "euler",
        "fact",
        "nCr",
        "nPr",
        "abs",
        "pct",
      ].includes(id)
    )
      return (
        base +
        "bg-violet-50 dark:bg-[#151e30] text-violet-500 dark:text-[#c4b5fd] text-xs"
      );
    if (["plus", "minus", "mul", "div"].includes(id))
      return (
        base +
        "bg-orange-50 dark:bg-[#2a1e10] text-[var(--accent)] text-lg font-bold"
      );
    if (["lp", "rp", "comma", "neg", "exp10", "ANS"].includes(id))
      return (
        base +
        "bg-slate-100 dark:bg-[#1e1c18] text-slate-500 dark:text-[#c5b8a8] text-xs"
      );
    return (
      base +
      "bg-slate-100 dark:bg-[#252018] text-gray-800 dark:text-[#f5f0e8] text-lg font-bold"
    );
  }

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
    <div className="flex flex-col flex-1 min-h-0 rounded-3xl overflow-hidden shadow-2xl w-full bg-white dark:bg-[#0f0d0a]">
      {/* Display */}
      <div className="shrink-0 px-5 pt-5 pb-4 flex flex-col gap-1.5 bg-gray-50 dark:bg-[#0a0807] border-b border-gray-200 dark:border-[#1e1a16]">
        <div className="flex items-center gap-1.5 h-5">
          <span
            className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded"
            style={{
              background:
                mode === "DEG"
                  ? "rgba(249,115,22,0.18)"
                  : "rgba(96,165,250,0.18)",
              color: mode === "DEG" ? "var(--accent)" : "#93c5fd",
            }}
          >
            {mode}
          </span>
          {shift && (
            <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-500 dark:text-yellow-400">
              SHIFT
            </span>
          )}
          {memory !== 0 && (
            <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-green-500/20 text-green-600 dark:text-green-400">
              M
            </span>
          )}
        </div>
        <div
          className="text-right font-mono text-sm min-h-5.5 break-all leading-snug"
          style={{
            color: error ? "#f87171" : justCalced ? "#9ca3af" : "#6b7280",
          }}
        >
          {displayExpr}
        </div>
        <div className="text-right font-mono font-bold min-h-10x items-end justify-end">
          {justCalced ? (
            <span
              className="text-gray-900 dark:text-[#f5f0e8]"
              style={{ fontSize: "clamp(20px, 5vw, 32px)" }}
            >
              {formatResult(ans)}
            </span>
          ) : previewResult ? (
            <span
              className="text-gray-400 dark:text-[#6a5a4a]"
              style={{ fontSize: "clamp(18px, 4vw, 28px)" }}
            >
              {previewResult}
            </span>
          ) : (
            <span
              className="text-gray-300 dark:text-[#2a2418]"
              style={{ fontSize: "clamp(20px, 5vw, 32px)" }}
            >
              0
            </span>
          )}
        </div>
      </div>

      {/* Buttons */}
      <div className="flex-1 min-h-0 flex flex-col gap-0.75 p-2.5 overflow-hidden bg-slate-50 dark:bg-[#0d0b09]">
        {ROWS.map((row, ri) => (
          <div key={ri} className="flex gap-0.75 flex-1 min-h-0">
            {row.map((btn) => (
              <button
                key={btn.id}
                onClick={() => handleBtn(btn.id)}
                className={
                  btnClass(btn.id) + (btn.wide ? " flex-2" : " flex-1")
                }
              >
                {btn.sub && (
                  <span
                    className="absolute top-0.75 text-[7px] font-bold leading-none"
                    style={{
                      color: shift ? "#fde68a" : "#9ca3af",
                      transition: "color 0.15s",
                    }}
                  >
                    {btn.sub}
                  </span>
                )}
                <span>{btn.id === "MODE" ? mode : btn.label}</span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GraphingCalc sub-component
// ─────────────────────────────────────────────────────────────────────────────

function GraphingCalc() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [functions, setFunctions] = useState<GraphFn[]>([
    { expr: "sin(x)", color: GRAPH_COLORS[0], error: null },
  ]);
  const [inputExpr, setInputExpr] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);

  // View state
  const [viewX, setViewX] = useState(0);
  const [viewY, setViewY] = useState(0);
  const [scale, setScale] = useState(40);

  // Drag state (refs to avoid stale closures in pointer events)
  const dragRef = useRef<{ active: boolean; lastX: number; lastY: number }>({
    active: false,
    lastX: 0,
    lastY: 0,
  });

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    // Background — respect dark/light mode
    const isDark = document.documentElement.classList.contains("dark");
    ctx.fillStyle = isDark ? "#0d0b09" : "#f9fafb";
    ctx.fillRect(0, 0, W, H);

    // Origin in canvas coords
    const ox = W / 2 - viewX * scale;
    const oy = H / 2 + viewY * scale;

    // Grid lines
    const step = scale; // 1 unit
    const startXUnit = Math.floor(-ox / step) - 1;
    const endXUnit = Math.ceil((W - ox) / step) + 1;
    const startYUnit = Math.floor(-oy / step) - 1;
    const endYUnit = Math.ceil((H - oy) / step) + 1;

    ctx.strokeStyle = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";
    ctx.lineWidth = 1;
    for (let xu = startXUnit; xu <= endXUnit; xu++) {
      const px = ox + xu * step;
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, H);
      ctx.stroke();
    }
    for (let yu = startYUnit; yu <= endYUnit; yu++) {
      const py = oy - yu * step;
      ctx.beginPath();
      ctx.moveTo(0, py);
      ctx.lineTo(W, py);
      ctx.stroke();
    }

    // Axes
    const axisColor = isDark ? "#e5e7eb" : "#374151";
    ctx.strokeStyle = axisColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, oy);
    ctx.lineTo(W, oy);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(ox, 0);
    ctx.lineTo(ox, H);
    ctx.stroke();

    // Tick marks + labels
    ctx.fillStyle = isDark ? "#9ca3af" : "#6b7280";
    ctx.font = "10px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    for (let xu = startXUnit; xu <= endXUnit; xu++) {
      if (xu === 0) continue;
      const px = ox + xu * step;
      ctx.beginPath();
      ctx.moveTo(px, oy - 3);
      ctx.lineTo(px, oy + 3);
      ctx.strokeStyle = axisColor;
      ctx.lineWidth = 1;
      ctx.stroke();
      if (Math.abs(xu) <= 10) ctx.fillText(String(xu), px, oy + 5);
    }
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (let yu = startYUnit; yu <= endYUnit; yu++) {
      if (yu === 0) continue;
      const py = oy - yu * step;
      ctx.beginPath();
      ctx.moveTo(ox - 3, py);
      ctx.lineTo(ox + 3, py);
      ctx.strokeStyle = axisColor;
      ctx.lineWidth = 1;
      ctx.stroke();
      if (Math.abs(yu) <= 10) ctx.fillText(String(yu), ox - 5, py);
    }

    // Plot functions
    functions.forEach((fn) => {
      if (fn.error) return;
      const sanitized = sanitizeGraphExpr(fn.expr);
      if (!sanitized) return;

      // Resolve CSS variable color to actual color for canvas
      const color = fn.color.startsWith("var(")
        ? getComputedStyle(canvas).getPropertyValue("--accent").trim() ||
          "#f97316"
        : fn.color;

      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();

      let penDown = false;
      for (let px = 0; px < W; px++) {
        const x = (px - ox) / scale;
        let y: number;
        try {
          y = evalGraphFn(sanitized, x);
        } catch {
          penDown = false;
          continue;
        }
        if (!isFinite(y) || isNaN(y)) {
          penDown = false;
          continue;
        }
        const py = oy - y * scale;
        if (!penDown) {
          ctx.moveTo(px, py);
          penDown = true;
        } else ctx.lineTo(px, py);
      }
      ctx.stroke();
    });
  }, [functions, viewX, viewY, scale]);

  useEffect(() => {
    draw();
  }, [draw]);

  // Resize observer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver(() => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      draw();
    });
    ro.observe(canvas);
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    draw();
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pointer drag
  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    dragRef.current = { active: true, lastX: e.clientX, lastY: e.clientY };
    (e.currentTarget as HTMLCanvasElement).setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!dragRef.current.active) return;
    const dx = e.clientX - dragRef.current.lastX;
    const dy = e.clientY - dragRef.current.lastY;
    dragRef.current.lastX = e.clientX;
    dragRef.current.lastY = e.clientY;
    setViewX((vx) => vx - dx / scale);
    setViewY((vy) => vy + dy / scale);
  }
  function onPointerUp() {
    dragRef.current.active = false;
  }

  function addFunction() {
    if (!inputExpr.trim()) return;
    const sanitized = sanitizeGraphExpr(inputExpr);
    if (!sanitized) {
      setInputError("Invalid expression. Only math characters allowed.");
      return;
    }
    try {
      evalGraphFn(sanitized, 1);
    } catch {
      setInputError("Could not parse expression.");
      return;
    }
    if (functions.length >= 5) {
      setInputError("Maximum 5 functions.");
      return;
    }
    setFunctions((prev) => [
      ...prev,
      {
        expr: inputExpr.trim(),
        color: GRAPH_COLORS[prev.length % GRAPH_COLORS.length],
        error: null,
      },
    ]);
    setInputExpr("");
    setInputError(null);
  }

  function removeFunction(i: number) {
    setFunctions((prev) => prev.filter((_, idx) => idx !== i));
  }

  return (
    <div className="flex flex-col gap-3 w-full">
      {/* Canvas */}
      <div
        className="w-full rounded-2xl overflow-hidden relative bg-gray-50 dark:bg-[#0d0b09]"
        style={{ height: "clamp(240px, 35vw, 400px)" }}
      >
        <canvas
          ref={canvasRef}
          className="w-full h-full"
          style={{ touchAction: "none", cursor: "grab", display: "block" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
        />
        {/* Zoom controls */}
        <div className="absolute top-2 right-2 flex flex-col gap-1">
          {[
            {
              label: "+",
              action: () => setScale((s) => Math.min(s * 1.3, 400)),
            },
            { label: "−", action: () => setScale((s) => Math.max(s / 1.3, 4)) },
            {
              label: "⟳",
              action: () => {
                setViewX(0);
                setViewY(0);
                setScale(40);
              },
            },
          ].map(({ label, action }) => (
            <button
              key={label}
              onClick={action}
              className="w-7 h-7 rounded-lg text-sm font-bold flex items-center justify-center transition-opacity hover:opacity-100 opacity-70 bg-slate-200 dark:bg-[#1e1c18]"
              style={{ color: "var(--accent)" }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Function list */}
      <div className="flex flex-col gap-1.5">
        {functions.map((fn, i) => {
          const dotColor = fn.color.startsWith("var(")
            ? "var(--accent)"
            : fn.color;
          return (
            <div
              key={i}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-mono bg-slate-100 dark:bg-[#1a1814]"
            >
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ background: dotColor }}
              />
              <span className="flex-1 truncate text-gray-700 dark:text-[#c5b8a8]">
                {fn.expr}
              </span>
              <button
                onClick={() => removeFunction(i)}
                className="text-gray-400 dark:text-[#5a4a3a] hover:text-red-400 transition-colors text-xs"
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>

      {/* Add function input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={inputExpr}
          onChange={(e) => {
            setInputExpr(e.target.value);
            setInputError(null);
          }}
          onKeyDown={(e) => e.key === "Enter" && addFunction()}
          placeholder="e.g. sin(x), x^2 + 1"
          className="flex-1 bg-slate-100 dark:bg-[#1a1814] border border-slate-200 dark:border-[#2a2418] rounded-xl px-3 py-2 text-sm font-mono text-gray-800 dark:text-[#c5b8a8] placeholder-gray-400 dark:placeholder-[#4a3a2a] outline-none focus:border-(--accent)"
        />
        <button
          onClick={addFunction}
          className="px-4 py-2 rounded-xl text-sm font-bold transition-opacity hover:opacity-90 active:scale-95"
          style={{ background: "var(--accent)", color: "white" }}
        >
          Plot
        </button>
      </div>
      {inputError && <p className="text-xs text-red-400">{inputError}</p>}
      <p className="text-[10px] text-gray-400 dark:text-[#4a3a2a]">
        Drag to pan · +/− to zoom · Supports: sin, cos, tan, sqrt, log, ln, abs,
        π, e, ^
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Converter sub-component
// ─────────────────────────────────────────────────────────────────────────────

// Static fallback rates (relative to USD)
const STATIC_RATES: Record<string, number> = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  JPY: 149.5,
  MYR: 4.71,
  AUD: 1.53,
  CAD: 1.36,
  CNY: 7.24,
};

function ConverterCalc() {
  const [category, setCategory] = useState<ConvCategory>("Length");

  const [fromIdx, setFromIdx] = useState(0);
  const [toIdx, setToIdx] = useState(1);
  const [fromVal, setFromVal] = useState("");

  // Live currency rates state
  const [rates, setRates] = useState<Record<string, number>>(STATIC_RATES);
  const [ratesLoaded, setRatesLoaded] = useState(false);
  const [ratesError, setRatesError] = useState(false);
  const [ratesTimestamp, setRatesTimestamp] = useState<string | null>(null);

  // Fetch live rates on mount
  useEffect(() => {
    fetch("/api/exchange-rates")
      .then((r) => r.json())
      .then((data: { base: string; rates: Record<string, number> }) => {
        setRates({ USD: 1, ...data.rates });
        setRatesLoaded(true);
        setRatesError(false);
        const now = new Date();
        setRatesTimestamp(
          `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`,
        );
      })
      .catch(() => {
        setRatesError(true);
        setRatesLoaded(true);
      });
  }, []);

  // Build currency units dynamically from current rates
  const liveCurrencyUnits: ConvUnit[] = [
    "USD",
    "EUR",
    "GBP",
    "JPY",
    "MYR",
    "AUD",
    "CAD",
    "CNY",
  ].map((code) => ({
    label: code,
    toBase: (v: number) => v / rates[code],
    fromBase: (v: number) => v * rates[code],
  }));

  const units =
    category === "Currency" ? liveCurrencyUnits : CONV_UNITS[category];

  // Reset unit indices when category changes
  useEffect(() => {
    setFromIdx(0);
    setToIdx(1);
    setFromVal("");
  }, [category]);

  const toVal = (() => {
    const v = parseFloat(fromVal);
    if (isNaN(v) || fromVal === "") return "";
    const base = units[fromIdx].toBase(v);
    const result = units[toIdx].fromBase(base);
    if (!isFinite(result)) return "—";
    // Format nicely
    const abs = Math.abs(result);
    if (abs !== 0 && (abs >= 1e10 || abs < 1e-6))
      return result.toExponential(6);
    return parseFloat(result.toPrecision(10)).toString();
  })();

  function swap() {
    setFromIdx(toIdx);
    setToIdx(fromIdx);
    setFromVal(toVal);
  }

  const inputClass =
    "w-full bg-gray-50 dark:bg-[#0f0d0a] border border-gray-200 dark:border-[#2a2418] rounded-xl px-3 py-2.5 text-base font-mono text-gray-900 dark:text-[#f5f0e8] placeholder-gray-400 dark:placeholder-[#3a2a1a] outline-none focus:border-[var(--accent)] transition-colors";
  const selectClass =
    "bg-slate-100 dark:bg-[#1a1814] border border-gray-200 dark:border-[#2a2418] rounded-xl px-2 py-2.5 text-sm font-mono text-gray-700 dark:text-[#c5b8a8] outline-none focus:border-[var(--accent)] transition-colors cursor-pointer";

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Category selector */}
      <div className="flex flex-wrap gap-1.5">
        {CONV_CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={
              "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 active:scale-95 " +
              (category === cat
                ? ""
                : "bg-slate-100 dark:bg-[#1a1814] text-gray-500 dark:text-[#7a6a56]")
            }
            style={
              category === cat
                ? { background: "var(--accent)", color: "white" }
                : undefined
            }
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Conversion rows */}
      <div className="flex flex-col gap-2">
        {/* From row */}
        <div className="flex gap-2 items-center">
          <input
            type="number"
            value={fromVal}
            onChange={(e) => setFromVal(e.target.value)}
            placeholder="0"
            className={inputClass + " flex-1 min-w-0"}
          />
          <select
            value={fromIdx}
            onChange={(e) => setFromIdx(Number(e.target.value))}
            className={selectClass}
          >
            {units.map((u, i) => (
              <option key={u.label} value={i}>
                {u.label}
              </option>
            ))}
          </select>
        </div>

        {/* Swap button */}
        <div className="flex justify-center">
          <button
            onClick={swap}
            className="w-8 h-8 rounded-full flex items-center justify-center text-base transition-transform hover:scale-110 active:scale-90 bg-slate-100 dark:bg-[#1a1814]"
            style={{ color: "var(--accent)" }}
            title="Swap"
          >
            ⇅
          </button>
        </div>

        {/* To row */}
        <div className="flex gap-2 items-center">
          <input
            type="text"
            value={toVal}
            readOnly
            placeholder="0"
            className={inputClass + " flex-1 min-w-0 opacity-80 cursor-default"}
          />
          <select
            value={toIdx}
            onChange={(e) => setToIdx(Number(e.target.value))}
            className={selectClass}
          >
            {units.map((u, i) => (
              <option key={u.label} value={i}>
                {u.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Currency status */}
      {category === "Currency" && (
        <p className="text-[10px] text-gray-400 dark:text-[#4a3a2a]">
          {!ratesLoaded
            ? "Loading rates\u2026"
            : ratesError
              ? "Live rates unavailable \u2014 using estimates"
              : `Live rates \u00b7 Frankfurter API \u00b7 fetched at ${ratesTimestamp}`}
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Date sub-component
// ─────────────────────────────────────────────────────────────────────────────

type DateSubMode = "Duration" | "Add/Subtract";

function DateCalc() {
  const today = format(new Date(), "yyyy-MM-dd");
  const [subMode, setSubMode] = useState<DateSubMode>("Duration");

  // Duration state
  const [dateA, setDateA] = useState(today);
  const [dateB, setDateB] = useState(today);

  // Add/Subtract state
  const [startDate, setStartDate] = useState(today);
  const [amount, setAmount] = useState("0");
  const [unit, setUnit] = useState<"days" | "months" | "years">("days");
  const [direction, setDirection] = useState<"add" | "subtract">("add");

  const inputClass =
    "bg-gray-50 dark:bg-[#0f0d0a] border border-gray-200 dark:border-[#2a2418] rounded-xl px-3 py-2.5 text-sm font-mono text-gray-900 dark:text-[#f5f0e8] outline-none focus:border-[var(--accent)] transition-colors w-full";

  // Duration result
  const durationResult = (() => {
    if (!dateA || !dateB) return null;
    const a = new Date(dateA + "T00:00:00");
    const b = new Date(dateB + "T00:00:00");
    const [from, to] = a <= b ? [a, b] : [b, a];
    const totalDays = differenceInDays(to, from);
    const years = differenceInCalendarYears(to, from);
    const months = differenceInCalendarMonths(to, from) % 12;
    // Days remainder
    const afterYM = addMonths(addYears(from, years), months);
    const remDays = differenceInDays(to, afterYM);
    return { years, months, days: remDays, totalDays, negative: a > b };
  })();

  // Add/subtract result
  const addResult = (() => {
    if (!startDate) return null;
    const n = parseInt(amount, 10);
    if (isNaN(n)) return null;
    const base = new Date(startDate + "T00:00:00");
    const delta = direction === "subtract" ? -Math.abs(n) : Math.abs(n);
    let result: Date;
    if (unit === "days") result = addDays(base, delta);
    else if (unit === "months") result = addMonths(base, delta);
    else result = addYears(base, delta);
    return format(result, "EEEE, MMMM d, yyyy");
  })();

  const pillBase =
    "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 active:scale-95 bg-slate-100 dark:bg-[#1a1814] text-gray-500 dark:text-[#7a6a56]";

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Sub-mode pills */}
      <div className="flex gap-2">
        {(["Duration", "Add/Subtract"] as DateSubMode[]).map((m) => (
          <button
            key={m}
            onClick={() => setSubMode(m)}
            className={
              subMode === m
                ? "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 active:scale-95"
                : pillBase
            }
            style={
              subMode === m
                ? { background: "var(--accent)", color: "white" }
                : undefined
            }
          >
            {m}
          </button>
        ))}
      </div>

      {subMode === "Duration" ? (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-gray-400 dark:text-[#5a4a3a] uppercase tracking-wide">
                From
              </label>
              <input
                type="date"
                value={dateA}
                onChange={(e) => setDateA(e.target.value)}
                className={inputClass}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-gray-400 dark:text-[#5a4a3a] uppercase tracking-wide">
                To
              </label>
              <input
                type="date"
                value={dateB}
                onChange={(e) => setDateB(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          {durationResult && (
            <div className="rounded-2xl p-4 flex flex-col gap-3 bg-gray-50 dark:bg-[#0f0d0a] border border-gray-200 dark:border-[#1e1a16]">
              {durationResult.negative && (
                <p className="text-[10px] text-amber-500">
                  Note: From date is later than To date
                </p>
              )}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: durationResult.years, label: "Years" },
                  { value: durationResult.months, label: "Months" },
                  { value: durationResult.days, label: "Days" },
                ].map(({ value, label }) => (
                  <div
                    key={label}
                    className="flex flex-col items-center gap-1 py-2 rounded-xl bg-slate-100 dark:bg-[#1a1814]"
                  >
                    <span
                      className="text-2xl font-bold font-mono"
                      style={{ color: "var(--accent)" }}
                    >
                      {value}
                    </span>
                    <span className="text-[10px] text-gray-400 dark:text-[#5a4a3a]">
                      {label}
                    </span>
                  </div>
                ))}
              </div>
              <div className="text-center text-xs font-mono text-gray-400 dark:text-[#7a6a56]">
                = {durationResult.totalDays.toLocaleString()} total days
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-gray-400 dark:text-[#5a4a3a] uppercase tracking-wide">
              Start date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={inputClass}
            />
          </div>

          <div className="flex gap-2 items-center">
            {/* Add/Subtract toggle */}
            <div className="flex rounded-xl overflow-hidden border border-gray-200 dark:border-[#2a2418]">
              {(["add", "subtract"] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => setDirection(d)}
                  className={
                    "px-3 py-2 text-xs font-semibold capitalize transition-all " +
                    (direction !== d
                      ? "bg-gray-50 dark:bg-[#0f0d0a] text-gray-400 dark:text-[#5a4a3a]"
                      : "")
                  }
                  style={
                    direction === d
                      ? { background: "var(--accent)", color: "white" }
                      : undefined
                  }
                >
                  {d}
                </button>
              ))}
            </div>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min="0"
              className="flex-1 min-w-0 bg-gray-50 dark:bg-[#0f0d0a] border border-gray-200 dark:border-[#2a2418] rounded-xl px-3 py-2 text-sm font-mono text-gray-900 dark:text-[#f5f0e8] outline-none focus:border-(--accent)"
            />
            <select
              value={unit}
              onChange={(e) =>
                setUnit(e.target.value as "days" | "months" | "years")
              }
              className="bg-slate-100 dark:bg-[#1a1814] border border-gray-200 dark:border-[#2a2418] rounded-xl px-2 py-2 text-sm font-mono text-gray-700 dark:text-[#c5b8a8] outline-none focus:border-(--accent) cursor-pointer"
            >
              <option value="days">Days</option>
              <option value="months">Months</option>
              <option value="years">Years</option>
            </select>
          </div>

          {addResult && (
            <div className="rounded-2xl p-4 text-center bg-gray-50 dark:bg-[#0f0d0a] border border-gray-200 dark:border-[#1e1a16]">
              <p className="text-[10px] text-gray-400 dark:text-[#5a4a3a] mb-1 uppercase tracking-wide">
                Result
              </p>
              <p
                className="text-lg font-semibold font-mono"
                style={{ color: "var(--accent)" }}
              >
                {addResult}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Root Calculator component
// ─────────────────────────────────────────────────────────────────────────────

export default function Calculator() {
  const [activeMode, setActiveMode] = useState<CalcMode>("Scientific");

  return (
    <div className="flex flex-col h-full w-full max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-3 shrink-0">
        <h1
          className="font-serif italic text-2xl mb-0.5"
          style={{ color: "var(--accent)" }}
        >
          Calculator
        </h1>
        <p className="text-xs text-gray-400 dark:text-[#9a8f7e]">
          {activeMode}
        </p>
      </div>

      {/* Mode tab bar */}
      <div
        className="flex gap-1.5 mb-3 shrink-0 overflow-x-auto pb-0.5"
        style={
          {
            scrollbarWidth: "none",
            msOverflowStyle: "none",
          } as React.CSSProperties
        }
      >
        {MODES.map((m) => (
          <button
            key={m}
            onClick={() => setActiveMode(m)}
            className={
              "shrink-0 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 active:scale-95 whitespace-nowrap " +
              (activeMode !== m
                ? "bg-slate-100 dark:bg-[#1a1814] text-gray-500 dark:text-[#7a6a56]"
                : "")
            }
            style={
              activeMode === m
                ? {
                    background: "var(--accent)",
                    color: "white",
                    boxShadow: "0 2px 8px rgba(var(--accent-rgb),0.35)",
                  }
                : undefined
            }
          >
            {m}
          </button>
        ))}
      </div>

      {/* Mode content */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {activeMode === "Scientific" && (
          <div className="flex flex-col h-full">
            <ScientificCalc />
          </div>
        )}
        {activeMode === "Graphing" && (
          <div className="pb-4">
            <GraphingCalc />
          </div>
        )}
        {activeMode === "Converter" && (
          <div className="pb-4">
            <ConverterCalc />
          </div>
        )}
        {activeMode === "Date" && (
          <div className="pb-4">
            <DateCalc />
          </div>
        )}
      </div>
    </div>
  );
}
