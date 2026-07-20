"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "w-full rounded-lg border border-line bg-ink px-3 py-2 text-sm text-text placeholder:text-ph outline-none focus:border-sand",
        className,
      )}
      {...props}
    />
  );
}
