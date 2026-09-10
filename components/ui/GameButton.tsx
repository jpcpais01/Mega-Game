import { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "danger" | "ghost";
  size?: "md" | "lg";
};

const VARIANT_CLASS: Record<string, string> = {
  primary: "game-btn-primary text-white",
  danger: "game-btn-danger text-white",
  ghost: "game-btn-ghost text-[var(--text-dim)]",
};

const SIZE_CLASS: Record<string, string> = {
  md: "py-3 text-sm",
  lg: "py-4 text-base",
};

export default function GameButton({ variant = "primary", size = "lg", className = "", children, ...rest }: Props) {
  return (
    <button
      className={`rounded-2xl font-bold tracking-wide ${VARIANT_CLASS[variant]} ${SIZE_CLASS[size]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
