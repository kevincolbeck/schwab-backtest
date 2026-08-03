"use client";

import { useEffect, useRef, useState } from "react";
import Button from "@/components/ui/Button";
import type { ChatTurn } from "@/lib/types";
import { CHAT_SUGGESTIONS } from "@/lib/constants";

export default function ChatPanel({
  messages,
  busy,
  onSend,
  disabled = false,
  intro,
  suggestions,
  placeholder,
}: {
  messages: ChatTurn[];
  busy: boolean;
  onSend: (text: string) => void;
  disabled?: boolean;
  /** Welcome copy shown above the suggestion chips while the conversation is empty. */
  intro?: string;
  /** Replaces the default suggestion chips (e.g. scratch-mode intake prompts). */
  suggestions?: string[];
  /** Replaces the default enabled-state input placeholder. */
  placeholder?: string;
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
    <div className="card flex h-full flex-col overflow-hidden">
      <div className="glass border-b border-hairline px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full motion-reduce:animate-none bg-accent opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
          </span>
          <h2 className="text-sm font-semibold">AI Strategist</h2>
        </div>
        <p className="mt-0.5 text-[11px] text-faint">
          Ask questions or change the strategy in plain English.
        </p>
      </div>

      <div ref={scrollRef} className="slim-scroll flex-1 overflow-y-auto px-4 py-3">
        {messages.length === 0 && !busy && (
          <div className="space-y-2">
            {intro && (
              <p className="mb-3 rounded-2xl rounded-bl-md border border-hairline bg-panel-2 px-3.5 py-2.5 text-sm leading-relaxed">
                {intro}
              </p>
            )}
            <p className="text-[11px] uppercase tracking-widest text-faint">Try one of these</p>
            {(suggestions ?? CHAT_SUGGESTIONS).map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                disabled={disabled}
                className="focus-ring block w-full rounded-xl border border-hairline bg-panel-2 px-3 py-2.5 text-left text-xs text-ink transition-colors hover:border-accent/60 hover:bg-accent-soft disabled:opacity-50"
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
              className={`max-w-[94%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                m.role === "user"
                  ? "ml-auto rounded-br-md bg-accent-soft"
                  : "mr-auto rounded-bl-md border border-hairline bg-panel-2"
              }`}
            >
              <span className="sr-only">{m.role === "user" ? "You: " : "Assistant: "}</span>
              {m.content}
            </div>
          ))}
          {busy && (
            <div
              role="status"
              className="mr-auto flex items-center gap-2 rounded-2xl rounded-bl-md border border-hairline bg-panel-2 px-3.5 py-2.5 text-sm text-muted"
            >
              <span className="inline-flex gap-1">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted motion-reduce:animate-none [animation-delay:0ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted motion-reduce:animate-none [animation-delay:120ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted motion-reduce:animate-none [animation-delay:240ms]" />
              </span>
              Thinking
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
                : placeholder ?? 'e.g. "what if the stop was 5% instead of 8%?"'
            }
            disabled={disabled}
            className="focus-ring flex-1 resize-none rounded-xl border border-hairline bg-background px-3 py-2 text-sm placeholder:text-faint focus:border-accent disabled:opacity-50"
          />
          <Button
            className="self-end"
            onClick={() => send(draft)}
            disabled={busy || disabled || !draft.trim()}
          >
            Send
          </Button>
        </div>
        <p className="mt-1.5 text-[10px] leading-relaxed text-faint">
          The assistant edits strategy specs and explains historical results. It can&apos;t
          predict prices and won&apos;t recommend real-money trades.
        </p>
      </div>
    </div>
  );
}

