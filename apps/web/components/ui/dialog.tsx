"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

// Dialog estilo shadcn/ui, sem dependência externa: overlay + card centrado.

export function Dialog({
  open,
  onClose,
  title,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className={cn(
          "w-[440px] max-w-[92vw] rounded-2xl border border-line bg-ink-2 p-5 shadow-[0_20px_50px_rgba(0,0,0,.6)]",
          className,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold tracking-wide text-text">{title}</h2>
          <button onClick={onClose} className="text-text-dim hover:text-text cursor-pointer">
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
