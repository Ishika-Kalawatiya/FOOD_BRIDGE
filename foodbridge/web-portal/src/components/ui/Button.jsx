import React from "react";
import { Loader2 } from "lucide-react";

export function Button({
  children,
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  className = "",
  type = "button",
  onClick,
  ...props
}) {
  const baseStyles =
    "inline-flex items-center justify-center font-medium font-['Quicksand'] tracking-wide transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed select-none rounded-[var(--radius-md)] focus-visible:ring-2 focus-visible:ring-offset-2";

  const sizeStyles = {
    sm: "px-3 py-1.5 text-xs font-semibold gap-1.5",
    md: "px-4 py-2.5 text-sm font-semibold gap-2",
    lg: "px-6 py-3.5 text-base font-bold gap-2.5",
  };

  const variantStyles = {
    primary:
      "bg-[var(--color-leaf-green)] hover:bg-[var(--color-leaf-green-light)] text-white shadow-[var(--shadow-warm-sm)] hover:shadow-[var(--shadow-warm-md)] active:scale-[0.98] focus-visible:ring-[var(--color-leaf-green)]",
    secondary:
      "bg-[var(--color-bg-subtle)] hover:bg-[#ebdcc9] text-[var(--color-forest-text)] border border-[var(--color-border)] shadow-[var(--shadow-warm-sm)] active:scale-[0.98] focus-visible:ring-[var(--color-border)]",
    ghost:
      "bg-transparent hover:bg-[var(--color-leaf-green-alpha)] text-[var(--color-leaf-green)] active:scale-[0.98] focus-visible:ring-[var(--color-leaf-green)]",
    danger:
      "bg-[var(--color-tomato-orange)] hover:bg-[var(--color-tomato-light)] text-white shadow-[var(--shadow-warm-sm)] active:scale-[0.98] focus-visible:ring-[var(--color-tomato-orange)]",
    mango:
      "bg-[var(--color-mustard)] hover:bg-[var(--color-mustard-dark)] text-[var(--color-forest-text)] font-bold shadow-[var(--shadow-warm-sm)] active:scale-[0.98] focus-visible:ring-[var(--color-mustard)]",
  };

  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      className={`${baseStyles} ${sizeStyles[size] || sizeStyles.md} ${variantStyles[variant] || variantStyles.primary} ${className}`}
      {...props}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin text-current" />}
      {children}
    </button>
  );
}
