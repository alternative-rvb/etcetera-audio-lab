import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/client/cn";
import { Tooltip } from "./tooltip";

// SECTION: Boutons de l'interface (primaire, secondaire, discret, danger) et boutons icône avec infobulle.

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--provider,var(--accent))] text-white shadow-sm enabled:hover:brightness-110",
  secondary: "border border-line bg-surface text-ink enabled:hover:border-line-strong enabled:hover:bg-sunken",
  ghost: "text-muted enabled:hover:bg-sunken enabled:hover:text-ink",
  danger: "border border-transparent text-danger enabled:hover:border-danger/40 enabled:hover:bg-danger/10",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "h-8 gap-1.5 px-2.5 text-xs",
  md: "h-9 gap-2 px-3 text-sm",
  lg: "h-10 gap-2 px-4 text-[0.95rem] font-semibold",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  /** Précision affichée en infobulle (raccourci clavier, conséquence de l'action). */
  tooltip?: ReactNode;
}

export function Button({ variant = "secondary", size = "md", icon, tooltip, className, children, type = "button", ...props }: ButtonProps) {
  const button = (
    <button
      type={type}
      className={cn(
        "inline-flex min-w-0 shrink-0 items-center justify-center rounded-lg font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className
      )}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
  return tooltip ? (
    <Tooltip label={tooltip} describe>
      {button}
    </Tooltip>
  ) : (
    button
  );
}

const ICON_BUTTON_CLASSES =
  "inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-muted transition hover:bg-sunken hover:text-ink disabled:pointer-events-none disabled:opacity-40";

/** Bouton sans texte : l'intitulé sert d'aria-label et d'infobulle. */
export function IconButton({ label, className, children, type = "button", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <Tooltip label={label}>
      <button type={type} aria-label={label} className={cn(ICON_BUTTON_CLASSES, className)} {...props}>
        {children}
      </button>
    </Tooltip>
  );
}

/** Lien sans texte (téléchargement, ouverture), même rendu qu'IconButton. */
export function IconLink({ label, className, children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { label: string }) {
  return (
    <Tooltip label={label}>
      <a aria-label={label} className={cn(ICON_BUTTON_CLASSES, className)} {...props}>
        {children}
      </a>
    </Tooltip>
  );
}
