"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { supabaseBrowser } from "@/lib/supabase/client";

const AuthModalContext = createContext<{ openAuth: (reason?: string) => void }>({
  openAuth: () => {},
});

export const useAuthModal = () => useContext(AuthModalContext);

// Configured in the Supabase dashboard; X/Twitter joins in Phase G.
const OAUTH_PROVIDERS = (process.env.NEXT_PUBLIC_OAUTH_PROVIDERS ?? "google,discord")
  .split(",")
  .map((p) => p.trim())
  .filter(Boolean) as Array<"google" | "discord" | "twitter">;

const PROVIDER_LABEL: Record<string, string> = {
  google: "Continue with Google",
  discord: "Continue with Discord",
  twitter: "Continue with X",
};

export default function AuthModalProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string | undefined>();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openAuth = useCallback((why?: string) => {
    setReason(why);
    setSent(false);
    setError(null);
    setOpen(true);
  }, []);

  const sendLink = async () => {
    const supabase = supabaseBrowser();
    if (!supabase || !email.trim() || busy) return;
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setBusy(false);
    if (err) setError(err.message);
    else setSent(true);
  };

  const oauth = async (provider: "google" | "discord" | "twitter") => {
    const supabase = supabaseBrowser();
    if (!supabase) return;
    await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  };

  return (
    <AuthModalContext.Provider value={{ openAuth }}>
      {children}
      <Modal open={open} onClose={() => setOpen(false)} title="Sign in to the lab">
        {reason && <p className="mb-4 text-sm text-muted">{reason}</p>}
        {OAUTH_PROVIDERS.length > 0 && (
          <div className="mb-4 space-y-2">
            {OAUTH_PROVIDERS.map((p) => (
              <Button key={p} variant="outline" className="w-full" onClick={() => oauth(p)}>
                {PROVIDER_LABEL[p]}
              </Button>
            ))}
            <div className="flex items-center gap-3 py-1 text-[11px] text-faint">
              <span className="h-px flex-1 bg-hairline" /> or <span className="h-px flex-1 bg-hairline" />
            </div>
          </div>
        )}
        {sent ? (
          <p role="status" className="rounded-lg border border-accent/40 bg-accent-soft p-3 text-sm">
            Check your email — your sign-in link is on the way to{" "}
            <span className="font-medium">{email}</span>.
          </p>
        ) : (
          <div className="space-y-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendLink()}
              placeholder="you@example.com"
              aria-label="Email address"
              className="focus-ring w-full rounded-[10px] border border-hairline bg-panel-2 px-3 py-2.5 text-sm placeholder:text-faint focus:border-accent"
            />
            <Button className="w-full" onClick={sendLink} disabled={busy || !email.trim()}>
              {busy ? "Sending…" : "Email me a sign-in link"}
            </Button>
            {error && (
              <p role="alert" className="text-sm text-loss">
                {error}
              </p>
            )}
            <p className="text-[11px] leading-relaxed text-faint">
              No password needed. Free to start — no card required.
            </p>
          </div>
        )}
      </Modal>
    </AuthModalContext.Provider>
  );
}
