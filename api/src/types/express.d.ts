/**
 * Module augmentation for Express's `Request.user`. Without this, every
 * controller writes `(req as any).user.userId` and lints scream.
 *
 * Populated by `JwtStrategy.validate` (auth/strategies/jwt.strategy.ts).
 * Mirror the return value of that function exactly.
 */
declare global {
  namespace Express {
    interface User {
      userId: string;
      email: string;
      role: string;
      tenantId: string | null;
      branch: string | null;
    }
  }
}

// Required to make this a module so the `declare global` block runs.
export {};
