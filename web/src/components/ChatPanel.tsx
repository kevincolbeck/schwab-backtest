"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatTurn } from "@/lib/types";
import { CHAT_SUGGESTIONS } from "@/lib/constants";

export default function ChatPanel({
  messages,
  busy,
  onSend,
  disabled = false,
}: {
  messages: ChatTurn[];
  busy: boolean;
  onSend: (text: string) => void;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  const send = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy || disabled) return;
    setDraft("");
    onSend(trimmed);
  };

  return (
    <div className="flex h-full flex-col rounded-lg border border-hairline bg-panel">
      <div className="border-b border-hairline px-4 py-2.5">
        <h2 className="text-sm font-medium">The what-if machine</h2>
        <p className="text-xs text-muted">
          Ask questions or change the strategy in plain English.
        </p>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3">
        {messages.length === 0 && !busy && (
          <div className="space-y-2">
            <p className="text-xs text-muted">Try one of these:</p>
            {CHAT_SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                disabled={disabled}
                className="block w-full rounded-md border border-hairline bg-panel-2 px-3 py-2 text-left text-xs text-ink hover:border-accent focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        <div role="log" aria-live="polite" aria-label="Conversation" className="space-y-3">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`max-w-[92%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm leading-relaxed ${
                m.role === "user"
                  ? "ml-auto bg-accent-soft"
                  : "mr-auto border border-hairline bg-panel-2"
              }`}
            >
              <span className="sr-only">{m.role === "user" ? "You: " : "Assistant: "}</span>
              {m.content}
            </div>
          ))}
          {busy && (
            <div
              role="status"
              className="mr-auto rounded-lg border border-hairline bg-panel-2 px-3 py-2 text-sm text-muted"
            >
              Thinking…
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-hairline p-3">
        <div className="flex gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(draft);
              }
            }}
            rows={2}
            aria-label="Ask about or change the strategy"
            placeholder={
              disabled
                ? "Run a backtest first, then ask about it"
                : 'e.g. "what if the stop was 5% instead of 8%?"'
            }
            disabled={disabled}
            className="flex-1 resize-none rounded-md border border-hairline bg-background px-3 py-2 text-sm placeholder:text-muted focus:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
          />
          <button
            onClick={() => send(draft)}
            disabled={busy || disabled || !draft.trim()}
            className="self-end rounded-md bg-accent px-4 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-40"
          >
            Send
          </button>
        </div>
        <p className="mt-1.5 text-[10px] text-muted">
          The assistant edits strategy specs and explains historical results. It can&apos;t
          predict prices and won&apos;t recommend real-money trades.
        </p>
      </div>
    </div>
  );
}
