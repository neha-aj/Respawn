import { motion } from 'framer-motion';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'ghost' | 'danger';

/** Blocky pixel button: blue-only states (brightness + offset shadow). */
export function PixelButton({ variant = 'primary', className = '', children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  const base = 'font-pixel text-[11px] tracking-wider uppercase px-4 py-3 transition-transform active:translate-y-[2px] disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan';
  const look: Record<Variant, string> = {
    primary: 'bg-electric text-abyss shadow-[0_4px_0_#103D78] hover:bg-cyan',
    ghost: 'bg-navy text-pale shadow-[0_4px_0_#020817] border-2 border-deep hover:border-cyan hover:text-ice',
    danger: 'bg-dark text-ice shadow-[0_4px_0_#020817] border-2 border-electric hover:bg-deep',
  };
  return <button type="button" {...rest} className={`${base} ${look[variant]} ${className}`}>{children}</button>;
}

export function IconButton({ label, children, active = false, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; active?: boolean; children: ReactNode }) {
  return (
    <button
      type="button" aria-label={label} title={label} {...rest}
      className={`flex h-10 items-center gap-2 border-2 px-3 font-pixel text-[9px] uppercase transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan ${active ? 'border-cyan bg-deep text-ice' : 'border-deep bg-navy text-pale hover:border-electric hover:text-ice'}`}
    >
      {children}
    </button>
  );
}

/** Full-frame modal backdrop + centred panel. */
export function Overlay({ children, wide = false, label }: { children: ReactNode; wide?: boolean; label: string }) {
  return (
    <motion.div
      className="absolute inset-0 z-30 flex items-center justify-center bg-abyss/80 p-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
      role="dialog" aria-modal="true" aria-label={label}
    >
      <motion.div
        className={`pixel-frame-bright max-h-full overflow-y-auto scroll-blue bg-navy p-6 ${wide ? 'w-[min(720px,100%)]' : 'w-[min(520px,100%)]'}`}
        initial={{ y: 16, scale: 0.98 }} animate={{ y: 0, scale: 1 }} exit={{ y: 8, opacity: 0 }} transition={{ type: 'spring', stiffness: 380, damping: 30 }}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}
