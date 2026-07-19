"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-to-b from-blood to-blood-dark text-sand-bright border border-[#c23] shadow-[0_0_14px_rgba(165,34,34,.4)] hover:from-[#b52828]",
        ghost: "bg-transparent text-text-dim border border-line-2 hover:bg-ink-3 hover:text-text",
        sand: "bg-sand text-ink border border-sand hover:bg-sand-bright",
        subtle: "bg-ink-3 text-text-dim border border-line hover:text-text",
      },
      size: {
        default: "h-9 px-4",
        sm: "h-7 px-2.5 text-xs rounded-md",
        icon: "h-8 w-8",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
