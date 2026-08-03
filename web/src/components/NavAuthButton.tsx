"use client";

import Link from "next/link";
import { useAuthModal } from "@/components/AuthModal";
import Button from "@/components/ui/Button";

export default function NavAuthButton({ signedIn }: { signedIn: boolean }) {
  const { openAuth } = useAuthModal();
  if (signedIn) {
    return (
      <Link
        href="/dashboard"
        className="focus-ring rounded-[10px] border border-hairline-strong px-3.5 py-1.5 text-sm hover:bg-panel-2"
      >
        Dashboard
      </Link>
    );
  }
  return (
    <Button size="sm" onClick={() => openAuth()}>
      Sign in
    </Button>
  );
}
