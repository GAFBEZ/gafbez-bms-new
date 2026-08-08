"use client";

import { useCallback, useEffect, useRef } from "react";
import { signOut } from "@/app/dashboard/actions";

const IDLE_TIMEOUT_MS = 15 * 60 * 1000;
const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "scroll", "touchstart"] as const;

/**
 * Auto-logs out an idle staff session after 15 minutes of no interaction.
 * This app is often left open on a shared counter terminal at a branch,
 * so a staff member walking away shouldn't leave sales/customer data
 * exposed indefinitely. Resets on any real interaction below; not on
 * plain focus/visibility events, which can fire without anyone actually
 * using the page.
 */
export function IdleLogout() {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetTimer = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      void signOut();
    }, IDLE_TIMEOUT_MS);
  }, []);

  useEffect(() => {
    resetTimer();
    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, resetTimer, { passive: true }));
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, resetTimer));
    };
  }, [resetTimer]);

  return null;
}
