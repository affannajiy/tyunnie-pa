"use client";

import { Music2, Gamepad2 } from "lucide-react";

type Props = {
  onNavigate: (panel: string) => void;
};

const CARDS = [
  {
    panel: "music",
    icon: Music2,
    title: "Music",
    desc: "Your playlist, album art and controls",
    color: "#ec4899",
  },
  {
    panel: "games",
    icon: Gamepad2,
    title: "Games",
    desc: "Chess, Tetris, Sudoku and more",
    color: "#f97316",
  },
];

export default function EntertainmentHub({ onNavigate }: Props) {
  return (
    <div>
      <div className="mb-6">
        <h1 className="font-serif italic text-2xl text-[#111010] dark:text-[#f0ebe3] mb-1">
          Play
        </h1>
        <p className="text-sm text-[#9a8f7e]">Rest is part of the work.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {CARDS.map((card) => (
          <button
            key={card.panel}
            onClick={() => onNavigate(card.panel)}
            className="text-left bg-white dark:bg-[#1a1814] border border-[#e8e2d8] dark:border-[#2a2520] rounded-2xl p-5 hover:border-(--accent) hover:-translate-y-1 hover:shadow-md transition-all group"
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-xl mb-3"
              style={{ backgroundColor: card.color === "#f97316" ? "rgba(var(--accent-rgb),0.094)" : `${card.color}18` }}
            >
              <card.icon size={20} strokeWidth={1.75} style={{ color: card.color }} />
            </div>
            <div className="font-bold text-[#111010] dark:text-[#f0ebe3] mb-1 group-hover:text-(--accent) transition-colors">
              {card.title}
            </div>
            <div className="text-xs text-[#9a8f7e]">{card.desc}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
