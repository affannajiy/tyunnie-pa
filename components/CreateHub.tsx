"use client";

import { PenLine, Wallet, Calculator, Gauge, Code2 } from "lucide-react";

type Props = {
  onNavigate: (panel: string) => void;
};

const CARDS = [
  {
    panel: "writing",
    icon: PenLine,
    title: "Writing",
    desc: "Drafts and long-form notes",
    color: "#3b82f6",
  },
  {
    panel: "snippets",
    icon: Code2,
    title: "Snippets",
    desc: "Code files and live execution",
    color: "#f97316",
  },
  {
    panel: "finance",
    icon: Wallet,
    title: "Finance",
    desc: "Income, expenses and analytics",
    color: "#eab308",
  },
  {
    panel: "calculator",
    icon: Calculator,
    title: "Calculator",
    desc: "All the calculation types",
    color: "#6366f1",
  },
  {
    panel: "speedtest",
    icon: Gauge,
    title: "Speed Test",
    desc: "Ping, download, and upload speed",
    color: "#0ea5e9",
  },
];

export default function CreateHub({ onNavigate }: Props) {
  return (
    <div>
      <div className="mb-6">
        <h1 className="font-serif italic text-2xl text-[#111010] dark:text-[#f0ebe3] mb-1">
          Create
        </h1>
        <p className="text-sm text-[#6f6455]">Make something.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {CARDS.map((card) => (
          <button
            key={card.panel}
            onClick={() => onNavigate(card.panel)}
            className="text-left bg-white dark:bg-[#1a1814] border border-[#e8e2d8] dark:border-[#2a2520] rounded-2xl p-5 hover:border-(--accent) hover:-translate-y-1 hover:shadow-md transition-all group"
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-xl mb-3"
              style={{
                backgroundColor:
                  card.color === "#f97316"
                    ? "rgba(var(--accent-rgb),0.094)"
                    : `${card.color}18`,
              }}
            >
              <card.icon size={20} strokeWidth={1.75} style={{ color: card.color }} />
            </div>
            <div className="font-bold text-[#111010] dark:text-[#f0ebe3] mb-1 group-hover:text-(--accent) transition-colors">
              {card.title}
            </div>
            <div className="text-xs text-[#6f6455]">{card.desc}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
