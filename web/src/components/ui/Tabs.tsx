"use client";

import { useId } from "react";

export interface TabDef {
  id: string;
  label: string;
  badge?: string | number;
}

export default function Tabs({
  tabs,
  active,
  onChange,
  baseId: baseIdProp,
  className = "",
}: {
  tabs: TabDef[];
  active: string;
  onChange: (id: string) => void;
  /** Stable id prefix so parents can wire aria-labelledby on tabpanels. */
  baseId?: string;
  className?: string;
}) {
  const autoId = useId();
  const baseId = baseIdProp ?? autoId;
  const select = (id: string) => {
    onChange(id);
    // Roving focus: keyboard selection moves DOM focus with it.
    requestAnimationFrame(() => document.getElementById(`${baseId}-${id}`)?.focus());
  };
  return (
    <div
      role="tablist"
      aria-label="Workspace views"
      className={`flex items-center gap-1 rounded-(--radius-control) border border-hairline bg-panel-2 p-1 ${className}`}
    >
      {tabs.map((tab) => {
        const selected = tab.id === active;
        return (
          <button
            key={tab.id}
            id={`${baseId}-${tab.id}`}
            role="tab"
            aria-selected={selected}
            aria-controls={`${baseId}-panel-${tab.id}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.id)}
            onKeyDown={(e) => {
              const idx = tabs.findIndex((t) => t.id === active);
              if (e.key === "ArrowRight") {
                e.preventDefault();
                select(tabs[(idx + 1) % tabs.length].id);
              }
              if (e.key === "ArrowLeft") {
                e.preventDefault();
                select(tabs[(idx - 1 + tabs.length) % tabs.length].id);
              }
            }}
            className={`focus-ring rounded-(--radius-tag) px-3.5 py-1.5 text-sm transition-colors duration-(--dur-micro) ${
              selected
                ? "border border-hairline bg-panel text-ink"
                : "text-muted hover:text-ink"
            }`}
          >
            {tab.label}
            {tab.badge !== undefined && (
              <span className="tnum ml-1.5 text-caption text-faint">{tab.badge}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
