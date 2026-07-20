"use client";

import { useActionState, useId, useState } from "react";
import { AlertCircle, Lock, Mail } from "lucide-react";
import { Logo } from "@/components/layout/Logo";
import { signIn, type LoginState } from "./actions";

interface LoginFormProps {
  businessName: string;
  businessAddress: string | null;
  businessPhone: string | null;
  businessEmail: string | null;
  logoUrl: string | null;
}

const initialState: LoginState = { error: null };

export function LoginForm({
  businessName,
  businessAddress,
  businessPhone,
  businessEmail,
  logoUrl,
}: LoginFormProps) {
  const [state, formAction, isPending] = useActionState(
    signIn,
    initialState,
  );
  const [forgotPasswordClicked, setForgotPasswordClicked] = useState(false);

  const emailId = useId();
  const passwordId = useId();

  const contactLine = [businessAddress, businessPhone, businessEmail]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-brand-green px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="rounded-2xl bg-white dark:bg-gray-900 p-6 shadow-lg sm:p-8">
          <div className="flex flex-col items-center text-center">
            <Logo showWordmark={false} size="lg" logoUrl={logoUrl} />
            <h1 className="mt-4 text-xl font-semibold text-brand-green dark:text-emerald-400">
              {businessName}
            </h1>
            <p className="text-xs font-semibold tracking-wide text-brand-gold dark:text-amber-400">
              BUSINESS MANAGEMENT SYSTEM
            </p>
          </div>

          <form action={formAction} className="mt-6 flex flex-col gap-4">
            <div>
              <label
                htmlFor={emailId}
                className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Email address
              </label>
              <div className="relative">
                <Mail
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-gray-500"
                  aria-hidden="true"
                />
                <input
                  id={emailId}
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="you@gafbezenergies.com"
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 py-2.5 pl-10 pr-3 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-brand-green focus:outline-none focus:ring-2 focus:ring-brand-green/30"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor={passwordId}
                className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Password
              </label>
              <div className="relative">
                <Lock
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-gray-500"
                  aria-hidden="true"
                />
                <input
                  id={passwordId}
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 py-2.5 pl-10 pr-3 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-brand-green focus:outline-none focus:ring-2 focus:ring-brand-green/30"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setForgotPasswordClicked(true)}
                className="text-xs font-medium text-brand-green dark:text-emerald-400 hover:underline focus:outline-none"
              >
                Forgot password?
              </button>
            </div>

            {forgotPasswordClicked && (
              <p className="-mt-2 text-xs text-gray-500 dark:text-gray-400" role="status">
                Password recovery isn&apos;t wired up yet — contact an
                administrator to reset your password for now.
              </p>
            )}

            {state.error && (
              <p
                className="flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-950/40 px-3 py-2 text-xs text-red-700 dark:text-red-400"
                role="alert"
              >
                <AlertCircle
                  className="mt-0.5 h-3.5 w-3.5 shrink-0"
                  aria-hidden="true"
                />
                {state.error}
              </p>
            )}

            <button
              type="submit"
              disabled={isPending}
              className="mt-2 w-full rounded-lg bg-brand-green py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-green-dark focus:outline-none focus:ring-2 focus:ring-brand-green/40 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? "Signing in…" : "Sign In"}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-white/60">
          &copy; {new Date().getFullYear()} {businessName}. All rights
          reserved.
        </p>
        {contactLine && (
          <p className="mt-1 text-center text-xs text-white/50">{contactLine}</p>
        )}
      </div>
    </div>
  );
}
