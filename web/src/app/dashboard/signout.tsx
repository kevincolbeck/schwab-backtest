"use client";

import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function SignOutButton() {
  const router = useRouter();
  return (
    <Button
      variant="secondary"
      onClick={async () => {
        await supabaseBrowser()?.auth.signOut();
        router.push("/");
        router.refresh();
      }}
    >
      Sign out
    </Button>
  );
}
