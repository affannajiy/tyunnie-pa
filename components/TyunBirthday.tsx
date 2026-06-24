"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { isTyunBirthday } from "@/lib/tyunPersona";

/**
 * Once-a-year "It's Taehyun's birthday today!" greeting. Fires only on Feb 5,
 * shown to everyone (logged-in and guests alike — it's delight, not a paid
 * feature). Dismissal is keyed to the year so it shows exactly once per Feb 5:
 * localStorage['tyunnie_tyun_bday_<year>']. Independent of the version-update
 * modal (that one is version-gated and hidden for guests).
 */
export default function TyunBirthday() {
  const [open, setOpen] = useState(false);
  const [accentRgb, setAccentRgb] = useState("249,115,22");
  const [year, setYear] = useState(0);

  useEffect(() => {
    if (!isTyunBirthday()) return;

    const saved = localStorage.getItem("tyunnie_accent");
    if (saved) setAccentRgb(saved);

    const y = new Date().getFullYear();
    setYear(y);
    if (localStorage.getItem(`tyunnie_tyun_bday_${y}`)) return;
    setOpen(true);
  }, []);

  function dismiss() {
    if (year) localStorage.setItem(`tyunnie_tyun_bday_${year}`, "1");
    setOpen(false);
  }

  if (!open) return null;

  const accent = `rgb(${accentRgb})`;

  return (
    <div
      className="fixed inset-0 z-100 flex items-center justify-center px-4 bg-black/40 backdrop-blur-sm"
      onClick={dismiss}
    >
      <div
        className="bg-white dark:bg-[#1a1815] border border-[#e8e2d8] dark:border-[#2a2620] rounded-2xl p-7 w-full max-w-sm shadow-2xl text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <Image
          src="/sprites/tyun-mood-celebrating.png"
          alt="Taehyun"
          width={360}
          height={460}
          priority
          style={{ width: "96px", height: "auto", margin: "0 auto" }}
        />
        <p
          className="text-[10px] font-bold uppercase tracking-[3px] font-mono mt-3 mb-1"
          style={{ color: accent }}
        >
          February 5 · 🐿️
        </p>
        <h2 className="font-serif italic text-2xl mb-2 text-[#111010] dark:text-[#f5f0e8]">
          It's Taehyun's birthday today
        </h2>
        <p className="text-sm text-[#4a4339] dark:text-[#bcb3a4] mb-6 leading-relaxed">
          Kang Taehyun turns another year today. He'd never make a big deal of it
          himself — so maybe say something nice in chat before he changes the
          subject.
        </p>
        <button
          onClick={dismiss}
          className="w-full py-2.5 rounded-xl text-white font-bold text-sm tracking-wide transition-all"
          style={{ background: accent }}
        >
          Happy birthday, Taehyun 🎂
        </button>
      </div>
    </div>
  );
}
