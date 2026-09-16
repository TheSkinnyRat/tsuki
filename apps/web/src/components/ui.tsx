"use client";

/**
 * The small pieces the design repeats: the navy switch, the hatched artwork
 * placeholder, the pill chip and the moon mark. Kept in one file so a spacing
 * change lands everywhere at once.
 */

export function Switch({
  on,
  label,
  onChange,
  disabled,
}: {
  on: boolean;
  label: string;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`flex h-[22px] w-[38px] flex-none cursor-pointer items-center rounded-full border p-[2px] transition-all duration-200 disabled:cursor-default disabled:opacity-40 ${
        on
          ? "justify-end border-[var(--color-accent)] bg-[var(--color-accent)]"
          : "justify-start border-[var(--color-line)] bg-transparent"
      }`}
    >
      <span
        className={`block size-4 rounded-full transition-all duration-200 ${
          on ? "bg-[var(--color-on-accent)]" : "bg-[var(--color-muted)]"
        }`}
      />
    </button>
  );
}

export function Artwork({
  src,
  size,
  radius,
  label,
}: {
  src: string | null | undefined;
  size: number;
  radius: number;
  label?: string;
}) {
  const box = {
    width: size,
    height: size,
    borderRadius: radius,
  };
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        style={box}
        className="flex-none border border-[var(--color-line)] object-cover"
      />
    );
  }
  return (
    <span
      style={box}
      className={`${size > 60 ? "hatch" : "hatch-sm"} grid flex-none place-items-end justify-start border border-[var(--color-line)] p-2.5`}
    >
      {label ? (
        <span className="rounded-[5px] border border-[var(--color-line)] bg-[var(--color-bg)] px-1.5 py-0.5 font-[family-name:var(--font-mono)] text-[10.5px] text-[var(--color-muted)]">
          {label}
        </span>
      ) : null}
    </span>
  );
}

export function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="max-w-full truncate rounded-full border border-[var(--color-line)] px-2.5 py-[3px] font-[family-name:var(--font-mono)] text-[11.5px] text-[var(--color-muted)]">
      {children}
    </span>
  );
}

export function MoonMark() {
  return (
    <span className="relative block size-[18px] overflow-hidden rounded-full bg-[var(--color-accent)]">
      <span className="absolute -top-[5px] left-[5px] block size-[18px] rounded-full bg-[var(--color-bg)]" />
    </span>
  );
}

/** Bordered list container, the design's main surface. */
export function Panel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`overflow-hidden rounded-xl border border-[var(--color-line)] ${className}`}
    >
      {children}
    </div>
  );
}

export function PanelHeader({
  title,
  meta,
}: {
  title: string;
  meta?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[var(--color-line)] px-4 py-[13px]">
      <span className="text-[13px] font-medium">{title}</span>
      {meta ? (
        <span className="font-[family-name:var(--font-mono)] text-[11.5px] text-[var(--color-muted)]">
          {meta}
        </span>
      ) : null}
    </div>
  );
}

export function Row({
  children,
  last,
}: {
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-4 px-4 py-[13px] ${
        last ? "" : "border-b border-[var(--color-line)]"
      }`}
    >
      {children}
    </div>
  );
}

export function RowText({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[13.5px]">{title}</div>
      {detail ? (
        <div className="mt-px text-xs text-[var(--color-muted)]">{detail}</div>
      ) : null}
    </div>
  );
}

export function SmallButton({
  children,
  onClick,
  muted,
  disabled,
  className = "",
}: {
  children: React.ReactNode;
  onClick: () => void;
  muted?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`h-8 cursor-pointer rounded-lg border border-[var(--color-line)] bg-transparent px-3 text-[12.5px] transition-colors duration-150 hover:border-[var(--color-halo)] disabled:cursor-default disabled:opacity-40 ${
        muted
          ? "text-[var(--color-muted)] hover:text-[var(--color-ink)]"
          : "text-[var(--color-ink)]"
      } ${className}`}
    >
      {children}
    </button>
  );
}
