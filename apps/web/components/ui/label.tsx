"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn(
        "mt-3 mb-1.5 block text-[10px] font-semibold uppercase tracking-[1.5px] text-sand-dim",
        className,
      )}
      {...props}
    />
  );
}
