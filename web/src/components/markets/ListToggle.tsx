"use client";

export type CalendarView = "calendar" | "list";

/** Calendar/List view switch — same chip grammar as the page's server-side
 *  ToggleChip (accent marks the ACTIVE state only, SYSTEM.md §1). */
export default function ListToggle({
  view,
  onChange,
}: {
  view: CalendarView;
  onChange: (view: CalendarView) => void;
}) {
  const chip = (id: CalendarView, label: string) => {
    const active = view === id;
    return (
      <button
        type="button"
        aria-pressed={active}
        onClick={() => onChange(id)}
        className={`focus-ring inline-flex items-center rounded-(--radius-control) border px-3 py-1.5 text-xs transition-colors duration-(--dur-micro) ${
          active
            ? "border-accent bg-accent-soft text-accent"
            : "border-hairline text-muted hover:border-hairline-strong hover:text-ink"
        }`}
      >
        {label}
      </button>
    );
  };
  return (
    <div role="group" aria-label="Calendar view" className="flex items-center gap-1.5">
      {chip("calendar", "Calendar")}
      {chip("list", "List")}
    </div>
  );
}
