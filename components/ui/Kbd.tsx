"use client";

export function Kbd({
  children,
  size = "sm",
}: {
  children: React.ReactNode;
  size?: "sm" | "md";
}) {
  return (
    <kbd
      className={[
        "font-mono bg-[#f3f0ea] dark:bg-[#2a2520] border border-[#e8e2d8] dark:border-[#3a3530] rounded text-[#9a8f7e] dark:text-[#b0a090]",
        size === "md" ? "text-[10px] px-2 py-0.5" : "text-[9px] px-1.5 py-0.5",
      ].join(" ")}
    >
      {children}
    </kbd>
  );
}
