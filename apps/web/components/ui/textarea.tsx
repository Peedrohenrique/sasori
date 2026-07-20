"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "w-full rounded-lg border border-line bg-ink px-3 py-2 text-sm text-text placeholder:text-ph outline-none focus:border-sand resize-none",
        className,
      )}
      {...props}
    />
  );
}
