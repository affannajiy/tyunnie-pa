// components/panels/Snippets.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import {
  getSnips,
  addSnip,
  updateSnip,
  deleteSnip,
  type Snip,
} from "@/lib/database";

type Props = {
  userId: string;
  onAction: (msg: string) => void;
  refreshKey?: number;
};

const LANGUAGES = [
  { value: "js", label: "JavaScript", color: "#f7df1e" },
  { value: "ts", label: "TypeScript", color: "#007acc" },
  { value: "py", label: "Python", color: "#3776ab" },
  { value: "css", label: "CSS", color: "#264de4" },
  { value: "html", label: "HTML", color: "#e44d26" },
  { value: "sql", label: "SQL", color: "#f29111" },
  { value: "bash", label: "Bash", color: "#4eaa25" },
  { value: "json", label: "JSON", color: "#9a8f7e" },
  { value: "other", label: "Other", color: "#9a8f7e" },
];

function getLangColor(value: string) {
  return LANGUAGES.find((l) => l.value === value)?.color ?? "#9a8f7e";
}

function getLangLabel(value: string) {
  return LANGUAGES.find((l) => l.value === value)?.label ?? value;
}

export default function Snippets({ userId, onAction, refreshKey }: Props) {
  const [snips, setSnips] = useState<Snip[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false); // unsaved changes

  // Editor state
  const [fileName, setFileName] = useState("untitled.js");
  const [language, setLanguage] = useState("js");
  const [code, setCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  // Search
  const [search, setSearch] = useState("");

  const codeRef = useRef<HTMLTextAreaElement>(null);

  // Terminal state
  const [output, setOutput] = useState("");
  const [running, setRunning] = useState(false);
  const [showTerminal, setShowTerminal] = useState(false);

  function loadSnip(snip: Snip) {
    setActiveId(snip.id);
    setFileName(snip.name);
    setLanguage(snip.language);
    setCode(snip.code ?? "");
    setIsDirty(false);
  }

  useEffect(() => {
    getSnips(userId).then((data) => {
      setSnips(data);
      setLoading(false);
      if (data.length > 0 && refreshKey && refreshKey > 0) {
        loadSnip(data[0]); // ← just use data[0] directly, no variable needed
        setShowTerminal(false);
        setOutput("");
      }
    });
  }, [userId, refreshKey]);

  // ── HELPERS ──

  function newSnip() {
    setActiveId(null);
    setFileName("untitled.js");
    setLanguage("js");
    setCode("");
    setIsDirty(false);
    codeRef.current?.focus();
  }

  // Auto-update language when filename extension changes
  function handleFileNameChange(val: string) {
    setFileName(val);
    setIsDirty(true);
    const ext = val.split(".").pop()?.toLowerCase() ?? "";
    const match = LANGUAGES.find((l) => l.value === ext);
    if (match) setLanguage(match.value);
  }

  // ── HANDLERS ──
  async function handleSave() {
    if (!code.trim() && !fileName.trim()) return;
    setSaving(true);

    if (activeId) {
      // Update existing snip
      await updateSnip(activeId, {
        name: fileName.trim() || "untitled",
        language,
        code,
      });
      setSnips((prev) =>
        prev.map((s) =>
          s.id === activeId
            ? { ...s, name: fileName.trim() || "untitled", language, code }
            : s,
        ),
      );
      onAction(`Snip saved — "${fileName}" is updated 💻`);
    } else {
      // Create new snip
      const newSnip = await addSnip(userId, {
        name: fileName.trim() || "untitled",
        language,
        code,
      });
      if (newSnip) {
        setSnips((prev) => [newSnip, ...prev]);
        setActiveId(newSnip.id);
        onAction(
          `New snip saved — "${fileName}". Good code deserves a good home 💻`,
        );
      }
    }

    setIsDirty(false);
    setSaving(false);
  }

  async function handleDelete(id: string, snipName: string) {
    await deleteSnip(id);
    const updated = snips.filter((s) => s.id !== id);
    setSnips(updated);

    // If we just deleted the active one, open the next or clear
    if (activeId === id) {
      if (updated.length > 0) {
        loadSnip(updated[0]);
      } else {
        newSnip();
      }
    }
    onAction(`Deleted "${snipName}".`);
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function runCode() {
    if (!code.trim()) return;
    setRunning(true);
    setShowTerminal(true);
    setOutput("Running...");

    try {
      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, language }),
      });

      const data = await res.json();
      setOutput(data.output || "(no output)");
    } catch {
      setOutput("Error: Could not connect to run engine.");
    }

    setRunning(false);
  }

  // Tab key inserts 2 spaces instead of jumping focus
  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Tab") {
      e.preventDefault();
      const el = e.currentTarget;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const next = code.substring(0, start) + "  " + code.substring(end);
      setCode(next);
      setIsDirty(true);
      // Restore cursor position after state update
      requestAnimationFrame(() => {
        el.selectionStart = start + 2;
        el.selectionEnd = start + 2;
      });
    } else if ((e.metaKey || e.ctrlKey) && e.key === "s") {
      e.preventDefault();
      handleSave();
    }
  }

  const filtered = snips.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.language.toLowerCase().includes(search.toLowerCase()),
  );

  // ── RENDER ──
  return (
    <div className="flex flex-col md:flex-row gap-4 h-auto md:h-[calc(100vh-120px)]">
      {/* ── FILE SIDEBAR ── */}
      <div className="flex flex-row md:flex-col gap-2 md:w-50 shrink-0 overflow-x-auto md:overflow-x-visible pb-2 md:pb-0">
        {/* New snip button */}
        <button
          onClick={newSnip}
          className="shrink-0 bg-[#f97316] text-white font-bold rounded-xl py-2.5 px-4 text-xs tracking-wide hover:bg-[#c2500f] transition-all hover:-translate-y-px whitespace-nowrap"
        >
          + New Snip
        </button>

        {/* Search */}
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search snips..."
          className="shrink-0 w-32 md:w-full bg-white border border-[#e8e2d8] rounded-xl px-3 py-2 text-xs outline-none focus:border-[#f97316] transition-colors"
        />

        {/* Snip file list */}
        <div className="flex flex-row md:flex-col gap-1.5 overflow-x-auto md:overflow-y-auto flex-1 md:flex-none">
          {loading && (
            <p className="text-xs text-[#c5bdb0] text-center py-4">
              Loading...
            </p>
          )}

          {!loading && filtered.length === 0 && (
            <p className="text-xs text-[#c5bdb0] text-center py-4 leading-relaxed">
              {search ? "No matches." : "No snips yet.\nHit + New Snip."}
            </p>
          )}

          {filtered.map((snip) => (
            <div
              key={snip.id}
              onClick={() => {
                if (snip.id !== activeId) loadSnip(snip);
              }}
              className={`
                flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer
                transition-all group border shrink-0 min-w-32 md:min-w-0
                ${
                  activeId === snip.id
                    ? "bg-[#fff0e6] border-[#f97316]"
                    : "bg-white border-[#e8e2d8] hover:border-[#fed7aa]"
                }
              `}
            >
              {/* Language colour dot */}
              <div
                className="w-2 h-2 rounded-full shrink-0"
                style={{ background: getLangColor(snip.language) }}
              />

              {/* File name */}
              <span className="flex-1 text-xs font-semibold text-[#111010] truncate">
                {snip.name}
              </span>

              {/* Delete — only visible on hover */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(snip.id, snip.name);
                }}
                className="text-[#c5bdb0] hover:text-red-500 text-xs opacity-0 group-hover:opacity-100 transition-all shrink-0"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* ── CODE EDITOR ── */}
      <div className="flex-1 bg-white border border-[#e8e2d8] rounded-2xl overflow-hidden flex flex-col min-h-[60vh] md:min-h-0">
        {/* Editor top bar */}
        <div className="bg-[#f3f0ea] border-b border-[#e8e2d8] px-3 py-2 flex flex-wrap items-center gap-2 shrink-0">
          {/* macOS-style dots */}
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
            <div className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
            <div className="w-3 h-3 rounded-full bg-[#28c840]" />
          </div>

          {/* File name input */}
          <input
            type="text"
            value={fileName}
            onChange={(e) => handleFileNameChange(e.target.value)}
            className="w-24 md:flex-1 bg-transparent border-none outline-none text-xs font-mono text-[#111010] placeholder:text-[#c5bdb0] min-w-0"
            placeholder="filename.js"
          />

          {/* Dirty indicator */}
          {isDirty && (
            <span className="text-[9px] font-mono text-[#9a8f7e] bg-[#e8e2d8] px-2 py-0.5 rounded-full">
              unsaved
            </span>
          )}

          {/* Language selector */}
          <div className="flex items-center gap-1.5">
            <div
              className="w-2 h-2 rounded-full shrink-0"
              style={{ background: getLangColor(language) }}
            />
            <select
              value={language}
              onChange={(e) => {
                setLanguage(e.target.value);
                setIsDirty(true);
              }}
              className="bg-transparent border-none outline-none text-xs font-mono text-[#9a8f7e] cursor-pointer"
            >
              {LANGUAGES.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>

          {/* Copy button */}
          <button
            onClick={handleCopy}
            className="text-[10px] font-mono text-[#9a8f7e] hover:text-[#f97316] transition-colors px-2 py-1 rounded-lg hover:bg-[#e8e2d8]"
          >
            {copied ? "✓ Copied" : "Copy"}
          </button>

          {/* Run button */}
          <button
            onClick={runCode}
            disabled={running || !code.trim()}
            className="bg-[#16a34a] text-white font-bold rounded-lg px-4 py-1.5 text-[10px] tracking-wide hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            {running ? (
              <>
                <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                Running...
              </>
            ) : (
              "▶ Run"
            )}
          </button>

          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-[#f97316] text-white font-bold rounded-lg px-4 py-1.5 text-[10px] tracking-wide hover:bg-[#c2500f] transition-all disabled:opacity-40"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>

        {/* Line numbers + code area */}
        <div className="flex flex-1 overflow-hidden font-mono text-sm">
          {/* Line numbers */}
          <div className="bg-[#faf8f5] border-r border-[#e8e2d8] px-3 py-4 text-right text-[#c5bdb0] text-xs leading-[1.8] select-none shrink-0 overflow-hidden">
            {(code || " ").split("\n").map((_, i) => (
              <div key={i}>{i + 1}</div>
            ))}
          </div>

          {/* Code textarea */}
          <textarea
            ref={codeRef}
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              setIsDirty(true);
            }}
            onKeyDown={handleKeyDown}
            spellCheck={false}
            placeholder="// write your code here..."
            className="flex-1 bg-[#faf8f5] border-none outline-none resize-none p-4 text-xs leading-[1.8] text-[#2d2416] font-mono placeholder:text-[#c5bdb0] min-h-[40vh] md:min-h-0"
          />
        </div>

        {/* Terminal output */}
        {showTerminal && (
          <div
            className="border-t border-[#e8e2d8] flex flex-col"
            style={{ minHeight: "140px", maxHeight: "220px" }}
          >
            {/* Terminal header */}
            <div className="bg-[#111010] px-4 py-2 flex items-center gap-2 shrink-0">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
                <div className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]" />
                <div className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
              </div>
              <span className="font-mono text-[10px] text-[#9a8f7e] flex-1">
                output — {fileName}
              </span>
              <button
                onClick={() => {
                  setShowTerminal(false);
                  setOutput("");
                }}
                className="text-[#4a4038] hover:text-[#9a8f7e] text-xs transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Output */}
            <div
              className="flex-1 bg-[#0d0d0d] px-4 py-3 overflow-y-auto"
              style={{
                scrollbarWidth: "thin",
                scrollbarColor: "#2a2520 transparent",
              }}
            >
              {running ? (
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className="w-1.5 h-1.5 rounded-full bg-[#f97316]"
                        style={{
                          animation: "thinkPulse 1.2s ease-in-out infinite",
                          animationDelay: `${i * 0.2}s`,
                        }}
                      />
                    ))}
                  </div>
                  <span className="font-mono text-[11px] text-[#9a8f7e]">
                    Running...
                  </span>
                </div>
              ) : (
                <pre className="font-mono text-[11px] text-[#c8ffb0] leading-[1.8] whitespace-pre-wrap wrap-break-word">
                  {output}
                </pre>
              )}
            </div>
          </div>
        )}

        {/* Status bar */}
        <div className="bg-[#f3f0ea] border-t border-[#e8e2d8] px-4 py-1.5 flex items-center gap-4 text-[9px] font-mono text-[#9a8f7e] shrink-0">
          <span>{getLangLabel(language)}</span>
          <span>{code.split("\n").length} lines</span>
          <span>{code.length} chars</span>
          <div className="flex-1" />
          <span className="text-[#c5bdb0]">Tab = 2 spaces · Cmd+S to save</span>
        </div>
      </div>
      <style>{`
        @keyframes thinkPulse {
          0%, 80%, 100% { transform: scale(0.7); opacity: 0.4; }
          40%           { transform: scale(1);   opacity: 1; }
        }
      `}</style>
    </div>
  );
}
