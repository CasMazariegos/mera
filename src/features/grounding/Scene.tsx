/** One calm scene: centred, generous space, heading focused on arrival (screen readers + keyboard). */
import { useEffect, useRef, type ReactNode } from "react";
import { motion } from "motion/react";

export function Scene({
  title,
  children,
  footer,
  top,
  labelledBy,
}: {
  title?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  top?: ReactNode;
  labelledBy?: string;
}) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, []);
  return (
    <motion.section
      aria-labelledby={labelledBy ?? "scene-title"}
      className="flex min-h-[100dvh] w-full flex-col items-center px-6 pt-20 pb-[max(2rem,env(safe-area-inset-bottom))] text-center"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.6, ease: [0.22, 0.61, 0.36, 1] }}
    >
      {top}
      <div className="flex w-full max-w-md flex-1 flex-col items-center justify-center">
        {title && (
          <h1
            id="scene-title"
            ref={ref}
            tabIndex={-1}
            className="font-display text-h1 font-medium tracking-tight text-balance text-ink outline-none sm:text-display"
          >
            {title}
          </h1>
        )}
        {children}
      </div>
      {footer && <div className="flex w-full max-w-md flex-col items-stretch gap-3">{footer}</div>}
    </motion.section>
  );
}
