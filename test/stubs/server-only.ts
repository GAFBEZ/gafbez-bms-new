// The real "server-only" package throws when imported outside Next.js's
// build-time "react-server" resolution condition, which Vitest does not
// set -- so without this stub, no test could ever import a module that
// starts with `import "server-only"` (e.g. src/lib/paystack.ts,
// src/lib/rateLimit.ts), regardless of how well-isolated its actual logic
// is. Aliased in vitest.config.ts. Mirrors what "server-only" itself
// resolves to under the real react-server condition: a no-op.
export {};
