/**
 * Self-contained math expression evaluator for Calculator.tsx.
 *
 * Replaces the previous `new Function()` evaluator. That design was safe only
 * as long as its allowlist regex held: the expression string still reached a
 * JavaScript evaluator, so every guard was one missed token away from code
 * execution — and it had already failed once, when the character-class
 * allowlist let `alert(1)` through because the letters for `sin`/`cos`/`sqrt`
 * also spell `alert`. SECURITY_Rulebook §2a.7: never pass user input to an
 * evaluator. That rule has no "unless the regex is good" clause.
 *
 * A recursive-descent parser removes the class instead of guarding it. The
 * tokenizer recognises only the calculator keypad's own vocabulary, and an
 * unknown character is a parse error rather than a value. Nothing here can name
 * a JavaScript identifier, so `constructor`, `fetch` and `import` are not
 * dangerous inputs — they are simply not tokens.
 *
 * Removing the last `new Function()` is also what lets `next.config.ts` drop
 * `unsafe-eval` from the Content-Security-Policy (§2b.4).
 *
 * Grammar (lowest precedence first):
 *   expr    := term (("+" | "-") term)*
 *   term    := unary (("*" | "/")? unary)*        implicit "*" when omitted
 *   unary   := "-" unary | power
 *   power   := postfix ("^" unary)?               right-associative
 *   postfix := primary "!"*
 *   primary := number | constant | variable | func "(" args ")" | "(" expr ")"
 */

// A parser cannot execute code, but it can still be asked to do too much work.
const MAX_EXPR_CHARS = 200;
const MAX_DEPTH = 32;

export type AngleMode = "DEG" | "RAD";

export interface EvalEnv {
  mode: AngleMode;
  /** `Ans` — the previous result. */
  ans: number;
  /** `Mem` — the memory register. */
  memory: number;
  /** `x` — bound only when graphing; absent in the calculator. */
  x?: number;
}

// ── Numeric helpers (here so the parser is the single owner of the vocabulary) ──

export function factorial(n: number): number {
  if (!Number.isInteger(n) || n < 0) return NaN;
  if (n > 170) return Infinity;
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

export function nCr(n: number, r: number): number {
  if (!Number.isInteger(n) || !Number.isInteger(r) || r < 0 || r > n) return NaN;
  return factorial(n) / (factorial(r) * factorial(n - r));
}

export function nPr(n: number, r: number): number {
  if (!Number.isInteger(n) || !Number.isInteger(r) || r < 0 || r > n) return NaN;
  return factorial(n) / factorial(n - r);
}

// ── Function table ──
// `deg` marks a function whose argument is an angle (converted on the way in),
// `inv` one whose result is an angle (converted on the way out). Hyperbolic
// functions take a plain number in both directions, so they are neither.

interface FnDef {
  arity: 1 | 2;
  fn: (...a: number[]) => number;
  deg?: boolean;
  inv?: boolean;
}

const FUNCS: Record<string, FnDef> = {
  sin: { arity: 1, fn: Math.sin, deg: true },
  cos: { arity: 1, fn: Math.cos, deg: true },
  tan: { arity: 1, fn: Math.tan, deg: true },
  asin: { arity: 1, fn: Math.asin, inv: true },
  acos: { arity: 1, fn: Math.acos, inv: true },
  atan: { arity: 1, fn: Math.atan, inv: true },
  sinh: { arity: 1, fn: Math.sinh },
  cosh: { arity: 1, fn: Math.cosh },
  tanh: { arity: 1, fn: Math.tanh },
  asinh: { arity: 1, fn: Math.asinh },
  acosh: { arity: 1, fn: Math.acosh },
  atanh: { arity: 1, fn: Math.atanh },
  log: { arity: 1, fn: Math.log10 },
  ln: { arity: 1, fn: Math.log },
  abs: { arity: 1, fn: Math.abs },
  sqrt: { arity: 1, fn: Math.sqrt },
  cbrt: { arity: 1, fn: Math.cbrt },
  nCr: { arity: 2, fn: nCr },
  nPr: { arity: 2, fn: nPr },
};

// Longest-first so `asinh` matches before `asin`, and `asin` before `sin`.
const FUNC_NAMES = Object.keys(FUNCS).sort((a, b) => b.length - a.length);

// Display glyphs the keypad emits, mapped to their canonical function name.
const GLYPH_FUNCS: Record<string, string> = { "√": "sqrt", "∛": "cbrt" };

const PI_GLYPH = "π";
const E_GLYPH = "ℯ";
const MINUS_GLYPH = "−";
const TIMES_GLYPH = "×";
const DIVIDE_GLYPH = "÷";

/** Thrown for any input the calculator vocabulary does not cover. */
class ParseError extends Error {}

// ─────────────────────────────────────────────────────────────────────────────
// Parser
// ─────────────────────────────────────────────────────────────────────────────

class Parser {
  private i = 0;
  private depth = 0;

  constructor(
    private readonly src: string,
    private readonly env: EvalEnv,
  ) {}

  /** Parse a whole expression and require that the input be fully consumed. */
  parse(): number {
    const v = this.expr();
    this.ws();
    if (this.i < this.src.length) {
      throw new ParseError("Unexpected trailing input");
    }
    return v;
  }

  // ── Scanning primitives ──

  private ws() {
    while (this.i < this.src.length && /\s/.test(this.src[this.i])) this.i++;
  }

  /** Consume `text` if it comes next (after whitespace). */
  private eat(text: string): boolean {
    this.ws();
    if (this.src.startsWith(text, this.i)) {
      this.i += text.length;
      return true;
    }
    return false;
  }

  private peek(): string {
    this.ws();
    return this.src[this.i] ?? "";
  }

  /**
   * True when `name` sits at the cursor and is not the prefix of a longer
   * identifier. This is what stops `e` from matching inside `escape` and `x`
   * from matching inside `xhr` — the check that makes a single-letter name safe
   * to have in the vocabulary at all.
   */
  private isBareName(name: string): boolean {
    this.ws();
    if (!this.src.startsWith(name, this.i)) return false;
    return !/[A-Za-z]/.test(this.src[this.i + name.length] ?? "");
  }

  // ── Grammar ──

  private expr(): number {
    let v = this.term();
    for (;;) {
      if (this.eat("+")) v += this.term();
      else if (this.eat("-") || this.eat(MINUS_GLYPH)) v -= this.term();
      else return v;
    }
  }

  private term(): number {
    let v = this.unary();
    for (;;) {
      if (this.eat("*") || this.eat(TIMES_GLYPH)) v *= this.unary();
      else if (this.eat("/") || this.eat(DIVIDE_GLYPH)) v /= this.unary();
      else if (this.startsPrimary()) v *= this.unary(); // implicit multiplication
      else return v;
    }
  }

  /**
   * True when the next token could begin a primary — which is what makes
   * `2(3+4)`, `2π` and `3sin(30)` multiply. A bare `-` is deliberately
   * excluded: `2-3` is a subtraction, never `2 * (-3)`.
   */
  private startsPrimary(): boolean {
    const c = this.peek();
    if (!c) return false;
    if (c === "(" || c === "." || (c >= "0" && c <= "9")) return true;
    if (c === PI_GLYPH || c === E_GLYPH) return true;
    if (Object.prototype.hasOwnProperty.call(GLYPH_FUNCS, c)) return true;
    // `e` never multiplies implicitly against the number in front of it. That
    // rule exists for one input: `1e5`. Read as implicit multiplication it is
    // 1 x e x 5 = 13.59, which is a confidently wrong answer to what everybody
    // means by it. There is no exponent notation in this grammar, so the honest
    // outcome is a parse failure — refuse the input, do not repair it (§2a.5).
    if (this.isBareName("e") && !/[0-9.]/.test(this.src[this.i - 1] ?? "")) {
      return true;
    }
    if (this.env.x !== undefined && this.isBareName("x")) return true;
    if (this.src.startsWith("Ans", this.i) || this.src.startsWith("Mem", this.i)) {
      return true;
    }
    return FUNC_NAMES.some((n) => this.src.startsWith(n, this.i));
  }

  private unary(): number {
    if (this.eat("-") || this.eat(MINUS_GLYPH)) return -this.unary();
    if (this.eat("+")) return this.unary();
    return this.power();
  }

  private power(): number {
    const base = this.postfix();
    // Right-associative, and the exponent may itself be signed: 2^-3, 2^3^2.
    if (this.eat("^")) return Math.pow(base, this.unary());
    return base;
  }

  private postfix(): number {
    let v = this.primary();
    // `!` only ever means factorial here; `!=` is not in the vocabulary.
    while (this.eat("!")) v = factorial(v);
    return v;
  }

  private primary(): number {
    if (++this.depth > MAX_DEPTH) throw new ParseError("Expression too deeply nested");
    try {
      this.ws();

      if (this.eat("(")) {
        const v = this.expr();
        if (!this.eat(")")) throw new ParseError("Missing )");
        return v;
      }

      // Constants
      if (this.eat(PI_GLYPH)) return Math.PI;
      if (this.eat(E_GLYPH)) return Math.E;
      if (this.eat("Ans")) return this.env.ans;
      if (this.eat("Mem")) return this.env.memory;

      // The keypad emits `ℯ`, but the graphing input is typed by hand and its
      // hint text offers plain `e`. Accepted as a bare name only — `e` followed
      // by another letter is the start of some other identifier, and that is a
      // parse error, not Euler's number times something.
      if (this.isBareName("e")) {
        this.i += 1;
        return Math.E;
      }

      // Graph variable — a name only when the caller bound it.
      if (this.env.x !== undefined && this.isBareName("x")) {
        this.i += 1;
        return this.env.x;
      }

      // Glyph functions: √( and ∛(
      const glyph = this.peek();
      if (Object.prototype.hasOwnProperty.call(GLYPH_FUNCS, glyph)) {
        this.i += 1;
        return this.callFunc(GLYPH_FUNCS[glyph]);
      }

      // Named functions
      for (const name of FUNC_NAMES) {
        if (this.src.startsWith(name, this.i)) {
          // Reject a longer identifier that merely starts with a known name.
          const after = this.src[this.i + name.length] ?? "";
          if (/[A-Za-z]/.test(after)) continue;
          this.i += name.length;
          return this.callFunc(name);
        }
      }

      // Number
      const num = /^\d*\.?\d+/.exec(this.src.slice(this.i));
      if (num) {
        this.i += num[0].length;
        return parseFloat(num[0]);
      }

      throw new ParseError("Unexpected token");
    } finally {
      this.depth--;
    }
  }

  private callFunc(name: string): number {
    const def = FUNCS[name];
    if (!this.eat("(")) throw new ParseError("Missing ( after function");
    const args: number[] = [this.expr()];
    while (this.eat(",")) args.push(this.expr());
    if (!this.eat(")")) throw new ParseError("Missing ) after function");
    if (args.length !== def.arity) throw new ParseError("Wrong argument count");

    const toRad = this.env.mode === "DEG" ? Math.PI / 180 : 1;
    const fromDeg = this.env.mode === "DEG" ? 180 / Math.PI : 1;
    if (def.deg) return def.fn(args[0] * toRad);
    if (def.inv) return def.fn(args[0]) * fromDeg;
    return def.fn(...args);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Evaluate a calculator expression. Returns `null` for anything that is not a
 * well-formed expression in the keypad's vocabulary, and for a non-numeric
 * result — callers treat both as "Math Error", never as a value.
 */
export function evaluateExpression(raw: string, env: EvalEnv): number | null {
  if (typeof raw !== "string") return null;
  const src = raw.trim();
  if (!src || src.length > MAX_EXPR_CHARS) return null;
  try {
    const v = new Parser(src, env).parse();
    return typeof v === "number" ? v : null;
  } catch {
    return null;
  }
}

/**
 * True when `raw` parses. Screens expressions arriving from outside the keypad
 * (Tyun's `calculate` action, a restored `tyunnie_calc_pending`) before they
 * are shown to the user. `Ans`/`Mem`/`x` are bound to 0 only so the parse can
 * complete — the value is discarded.
 */
export function isValidExpression(raw: string, opts?: { x?: boolean }): boolean {
  if (typeof raw !== "string") return false;
  const src = raw.trim();
  if (!src || src.length > MAX_EXPR_CHARS) return false;
  const env: EvalEnv = { mode: "RAD", ans: 0, memory: 0 };
  if (opts?.x) env.x = 0;
  try {
    new Parser(src, env).parse();
    return true;
  } catch {
    return false;
  }
}
