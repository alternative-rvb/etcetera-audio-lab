import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/client/cn";

// SECTION: Boutons de l'interface (primaire, secondaire, discret, danger).

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--provider,var(--accent))] text-white shadow-sm hover:brightness-110 retro:text-[#040914] retro:shadow-[0_0_18px_var(--provider,var(--accent))]",
  secondary: "border border-line bg-surface text-ink hover:border-line-strong hover:bg-sunken",
  ghost: "text-muted hover:bg-sunken hover:text-ink",
  danger: "border border-transparent text-danger hover:border-danger/40 hover:bg-danger/10",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "h-8 gap-1.5 px-2.5 text-xs",
  md: "h-9 gap-2 px-3.5 text-sm",
  lg: "h-11 gap-2 px-5 text-[0.95rem] font-semibold",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
}

export function Button({ variant = "secondary", size = "md", icon, className, children, type = "button", ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-lg font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
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
}

export function IconButton({ label, className, children, type = "button", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-muted transition hover:bg-sunken hover:text-ink disabled:opacity-40",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
