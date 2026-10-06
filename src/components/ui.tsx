/** Small, shared UI primitives. Large touch targets, visible focus, semantic HTML. */
import type { ButtonHTMLAttributes, ReactNode } from "react";

const cx = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(" ");

type Variant = "primary" | "quiet" | "ghost" | "choice";

export function Button({
  variant = "primary",
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; children: ReactNode }) {
  return (
    <button
      type="button"
      className={cx(
        "inline-flex min-h-14 items-center justify-center gap-2 rounded-full px-7 text-body font-semibold tracking-[0.01em] transition-[background,transform,box-shadow] duration-300 ease-[var(--ease-calm)] select-none disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary" && "bg-accent text-on-accent shadow-gentle hover:brightness-110 active:scale-[0.99]",
        variant === "quiet" && "border border-line-strong bg-surface text-ink hover:bg-elevated",
        variant === "ghost" && "min-h-12 px-4 font-medium text-ink-2 underline-offset-4 hover:text-ink hover:underline",
        variant === "choice" &&
          "min-h-16 w-full justify-start rounded-[var(--radius-soft)] border border-line bg-surface px-5 text-left text-h3 font-medium text-ink hover:border-line-strong hover:bg-elevated",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cx("text-micro font-semibold tracking-[0.14em] text-muted uppercase", className)}>{children}</p>;
}

export function Page({ title, eyebrow, intro, children }: { title: string; eyebrow?: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-xl px-6 pt-6 pb-32">
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <h1 className="mt-2 font-display text-h1 font-medium tracking-tight text-ink">{title}</h1>
      {intro && <div className="mt-3 text-body text-ink-2">{intro}</div>}
      <div className="mt-8">{children}</div>
    </div>
  );
}

export function EmptyState({ title, body, children }: { title: string; body: string; children?: ReactNode }) {
  return (
    <div className="rounded-[var(--radius-soft)] border border-dashed border-line-strong px-6 py-10 text-center">
      <p className="font-display text-h3 text-ink">{title}</p>
      <p className="mt-2 text-body text-ink-2">{body}</p>
      {children && <div className="mt-6">{children}</div>}
    </div>
  );
}

export function Toggle({ label, hint, checked, onChange, id }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void; id: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-4">
      <div>
        <label htmlFor={id} className="text-body font-medium text-ink">
          {label}
        </label>
        {hint && (
          <p id={`${id}-hint`} className="mt-0.5 text-small text-ink-2">
            {hint}
          </p>
        )}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={hint ? `${id}-hint` : undefined}
        onClick={() => onChange(!checked)}
        className={cx(
          "relative mt-1 inline-flex h-8 w-14 shrink-0 items-center rounded-full border transition-colors duration-300",
          checked ? "border-accent bg-accent" : "border-line-strong bg-sunk",
        )}
      >
        <span className={cx("ml-1 inline-block size-6 rounded-full bg-elevated shadow-gentle transition-transform duration-300", checked && "translate-x-6")} />
        <span className="sr-only">{checked ? "On" : "Off"}</span>
      </button>
    </div>
  );
}

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  name,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (v: T) => void;
  name: string;
}) {
  return (
    <fieldset className="py-4">
      <legend className="text-body font-medium text-ink">{label}</legend>
      <div className="mt-3 flex flex-wrap gap-2">
        {options.map((o) => (
          <label
            key={o.value}
            className={cx(
              "inline-flex min-h-12 cursor-pointer items-center rounded-full border px-4 text-small font-medium transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--focus)]",
              value === o.value ? "border-accent bg-accent-soft text-ink" : "border-line text-ink-2 hover:border-line-strong",
            )}
          >
            <input type="radio" className="sr-only" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} />
            {value === o.value && (
              <span aria-hidden className="mr-1.5">
                ✓
              </span>
            )}
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
