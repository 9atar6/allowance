"use client";

import { useState } from "react";

interface Props {
  /** Server's verdict on first render: is this still a fresh account? */
  isFreshAccount: boolean;
  onboarding: React.ReactNode;
  dashboard: React.ReactNode;
}

/**
 * Decides between onboarding and the full dashboard, and makes the choice
 * sticky for the lifetime of the page. Without this, minting the FIRST key
 * revalidates the page, "fresh account" flips false, and the onboarding card
 * unmounts mid-flow — destroying the one-time key display and the Test-it
 * button right after the user minted. The swap now happens on the next visit.
 */
export function OnboardingGate({ isFreshAccount, onboarding, dashboard }: Props) {
  const [showOnboarding] = useState(isFreshAccount);
  return <>{showOnboarding ? onboarding : dashboard}</>;
}
