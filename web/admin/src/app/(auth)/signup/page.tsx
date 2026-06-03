import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Sign up",
  description: "Create an account",
};

export default function SignupPage() {
  return (
    <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 text-center shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
      <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
        Sign up
      </h2>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Sign up flow can be added here.
      </p>
      <Link
        href="/login"
        className="mt-4 inline-block text-sm font-medium text-foreground underline hover:no-underline"
      >
        Back to Sign in
      </Link>
    </div>
  );
}
