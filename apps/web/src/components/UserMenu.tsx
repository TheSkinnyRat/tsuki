"use client";

import { useEffect, useRef, useState } from "react";
import { LogOut } from "lucide-react";
import { signOutAction } from "@/app/actions.ts";

/**
 * The avatar in the dashboard header, and the only way out of a session.
 * Closes on an outside click or Escape so it never sits over the queue.
 */
export function UserMenu({
  image,
  name,
}: {
  image: string | null;
  name: string | null;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-label="Account"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="grid size-7 cursor-pointer place-items-center rounded-full border-0 bg-transparent p-0"
      >
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt=""
            className="size-7 rounded-full border border-[var(--color-line)]"
          />
        ) : (
          <span className="hatch-sm block size-7 rounded-full border border-[var(--color-line)]" />
        )}
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute top-[calc(100%+8px)] right-0 z-30 w-[200px] overflow-hidden rounded-lg border border-[var(--color-line)] bg-[var(--color-bg)] shadow-[0_8px_24px_rgba(0,0,0,0.12)]"
        >
          {name ? (
            <div className="truncate border-b border-[var(--color-line)] px-3 py-2.5 text-[12.5px] text-[var(--color-muted)]">
              Signed in as{" "}
              <span className="font-medium text-[var(--color-ink)]">{name}</span>
            </div>
          ) : null}
          <form action={signOutAction}>
            <button
              type="submit"
              role="menuitem"
              className="flex w-full cursor-pointer items-center gap-2 border-0 bg-transparent px-3 py-2.5 text-left text-[13px] text-[var(--color-ink)] transition-colors duration-150 hover:bg-[var(--color-soft)]"
            >
              <LogOut size={14} strokeWidth={2} aria-hidden />
              Sign out
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
