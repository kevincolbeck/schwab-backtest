"use client";

import { useAuthModal } from "@/components/AuthModal";
import Button, { ButtonLink } from "@/components/ui/Button";

export default function NavAuthButton({ signedIn }: { signedIn: boolean }) {
  const { openAuth } = useAuthModal();
  if (signedIn) {
    return (
      <ButtonLink href="/dashboard" variant="secondary" size="sm">
        Dashboard
      </ButtonLink>
    );
  }
  return (
    <Button size="sm" onClick={() => openAuth()}>
      Sign in
    </Button>
  );
}
