"use client";

import { useId } from "react";

export interface TabDef {
  id: string;
  label: string;
  badge?: string | number;
}

/** The id a tabpanel MUST carry for its tab's aria-controls to resolve.
 *  Exported because that reference was dangling on every tab in the app —
 *  aria-controls pointed at panel ids no consumer ever rendered, which is an
 *  invalid ARIA reference (axe: aria-valid-attr-value, critical), and it
 *  meant a screen reader could not jump from a tab to its content. */
export const tabPanelId = (baseId: string, tabId: string) => `${baseId}-panel-${tabId}`;
/** The tab button's own id, for the panel's aria-labelledby. */
export const tabButtonId = (baseId: string, tabId: string) => `${baseId}-${tabId}`;

export default function Tabs({
  tabs,
  active,
  onChange,
  baseId: baseIdProp,
  ariaLabel = "Workspace views",
  hasPanels = true,
  className = "",
}: {
  tabs: TabDef[];
  active: string;
  onChange: (id: string) => void;
  /** Stable id prefix so parents can wire aria-labelledby on tabpanels. */
  baseId?: string;
  /** Accessible tablist name — default keeps the playground's label. */
  ariaLabel?: string;
  /** Set false when the consumer does NOT render tabpanels — omitting
   *  aria-controls is correct; pointing it at nothing is not. */
  hasPanels?: boolean;
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
      aria-label={ariaLabel}
      className={`flex items-center gap-1 rounded-(--radius-control) border border-hairline bg-panel-2 p-1 ${className}`}
    >
      {tabs.map((tab) => {
        const selected = tab.id === active;
        return (
          <button
            key={tab.id}
            id={tabButtonId(baseId, tab.id)}
            role="tab"
            aria-selected={selected}
            aria-controls={hasPanels ? tabPanelId(baseId, tab.id) : undefined}
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
            className={`focus-ring rounded-(--radius-tag) tap-target px-3.5 py-1.5 text-sm transition-colors duration-(--dur-micro) ${
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
