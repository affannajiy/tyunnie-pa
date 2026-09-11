// components/games/mahjong/TileView.tsx
"use client";

import { type Tile, SUIT_LABEL, WIND_NAMES, DRAGON_NAMES, FLOWER_NAMES } from "./tiles";

// Hand-drawn tile rather than the Unicode mahjong block: 🀇–🀫 render on iOS
// and Windows but come out as tofu on most Android keyboards' fallback font.
// The Chinese characters here are typographic labels, same exemption as the
// chess/card glyphs in CLAUDE.md.
const SUIT_COLOUR: Record<string, string> = {
  m: "text-red-700",
  p: "text-blue-800",
  s: "text-green-700",
};

export default function TileView({
  tile,
  width,
  faceDown,
  selected,
  hint,
  dim,
  onClick,
  label,
}: {
  tile?: Tile;
  /** Pixel width; height follows at 1.35×. */
  width: number;
  faceDown?: boolean;
  selected?: boolean;
  /** Hint ring — "the bot would throw this one". */
  hint?: boolean;
  dim?: boolean;
  onClick?: () => void;
  label?: string;
}) {
  const height = Math.round(width * 1.35);
  const style = { width, height, fontSize: Math.max(9, Math.round(width * 0.42)) };
  const Tag = onClick ? "button" : "div";

  if (faceDown || !tile) {
    return (
      <div
        className="rounded-[3px] border border-[#c2500f] bg-[#f97316] shrink-0"
        style={{ width, height }}
        aria-hidden
      />
    );
  }

  let big: string, small: string | null = null, colour = "text-[#111010]";
  if (tile.suit === "w") big = WIND_NAMES[tile.rank - 1];
  else if (tile.suit === "d") {
    big = DRAGON_NAMES[tile.rank - 1];
    colour = ["text-red-700", "text-green-700", "text-blue-800"][tile.rank - 1];
    if (tile.rank === 3) big = "";
  } else if (tile.suit === "f") {
    big = FLOWER_NAMES[tile.rank - 1];
    colour = "text-amber-700";
  } else {
    big = String(tile.rank);
    small = SUIT_LABEL[tile.suit];
    colour = SUIT_COLOUR[tile.suit];
  }

  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      aria-label={label ?? undefined}
      aria-pressed={onClick ? !!selected : undefined}
      className={`no-tap shrink-0 rounded-[3px] border bg-white flex flex-col items-center justify-center leading-none font-bold transition-[transform,border-color,box-shadow] duration-150
        ${selected ? "border-[#f97316] -translate-y-2 shadow-md" : "border-[#e8e2d8]"}
        ${hint && !selected ? "ring-2 ring-[#f97316]/50 ring-offset-1" : ""}
        ${dim ? "opacity-50" : ""}
        ${onClick ? "cursor-pointer hover:border-[#f97316]" : ""} ${colour}`}
      style={style}
    >
      {tile.suit === "d" && tile.rank === 3 ? (
        <span className="block rounded-[2px] border-2 border-current" style={{ width: width * 0.45, height: height * 0.45 }} />
      ) : (
        <span style={{ fontSize: small ? style.fontSize * 1.15 : style.fontSize * 1.25 }}>{big}</span>
      )}
      {small && <span className="mt-[2px]" style={{ fontSize: style.fontSize * 0.6 }}>{small}</span>}
    </Tag>
  );
}
