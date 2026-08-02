"use client";

import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function SignOutButton() {
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        await supabaseBrowser()?.auth.signOut();
        router.push("/");
        router.refresh();
      }}
      className="rounded-md border border-hairline px-4 py-2 text-sm text-muted hover:text-ink"
    >
      Sign out
    </button>
  );
}
