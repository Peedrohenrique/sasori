"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "w-full rounded-lg border border-line bg-ink px-2.5 py-2 text-sm text-text outline-none focus:border-sand cursor-pointer",
        className,
      )}
      {...props}
    />
  );
}
