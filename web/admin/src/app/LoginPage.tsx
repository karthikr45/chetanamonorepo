"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { LoginForm } from "@/features/auth";
import { useAuth } from "@/features/auth";
import {
  getStoredRefreshToken,
  refreshAccessToken,
  getStoredUser,
} from "@/features/auth/services";

const LOGO_SRC = "/svbk_logo.webp";

const FEATURES = [
  { title: "Multi-tenant school management", desc: "One console, every branch" },
  { title: "Real-time fee collection", desc: "Razorpay & Cashfree, unified" },
  { title: "Parent & students portals", desc: "OTP login, mobile-ready" },
];

function getRedirectPath(role?: string): string {
  return role === "super_admin" ? "/tenants" : "/dashboard";
}

export function LoginPage() {
  const router = useRouter();
  const { isAuthenticated, user, setToken, setUser } = useAuth();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    async function checkSession() {
      if (isAuthenticated) {
        router.replace(getRedirectPath(user?.role));
        return;
      }
      const refreshToken = getStoredRefreshToken();
      if (refreshToken) {
        try {
          const newToken = await refreshAccessToken();
          if (newToken) {
            const storedUser = getStoredUser();
            setToken(newToken);
            setUser(storedUser);
            router.replace(getRedirectPath(storedUser?.role));
            return;
          }
        } catch {
          /* fall through */
        }
      }
      setChecking(false);
    }
    checkSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (checking) {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        style={{ backgroundColor: "#f1f5f9" }}
      >
        <Spinner />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center p-4 sm:p-8 relative overflow-hidden"
      style={{
        background:
          "radial-gradient(60% 50% at 0% 0%, rgba(108,115,156,0.10), transparent 60%)," +
          "radial-gradient(60% 50% at 100% 100%, rgba(139,92,246,0.08), transparent 60%)," +
          "#f1f5f9",
      }}
    >
      {/* Decorative grid */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(#0f172a 1px, transparent 1px), linear-gradient(90deg, #0f172a 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      <div
        className="relative w-full max-w-[1040px] grid grid-cols-1 md:grid-cols-[5fr_6fr] overflow-hidden rounded-3xl bg-white"
        style={{
          boxShadow:
            "0 32px 80px -16px rgba(15,23,42,0.18), 0 12px 32px -12px rgba(15,23,42,0.10)",
          border: "1px solid rgba(15,23,42,0.06)",
        }}
      >
        {/* LEFT: brand panel */}
        <div
          className="relative hidden md:flex flex-col justify-between p-10 text-white overflow-hidden min-h-[640px]"
          style={{
            background:
              "linear-gradient(150deg, #6c739c 0%, #565c82 60%, #3a3c5e 100%)",
          }}
        >
          {/* Decorative blurred blobs */}
          <div
            aria-hidden
            className="absolute rounded-full blur-3xl opacity-30"
            style={{
              width: 320,
              height: 320,
              top: -80,
              left: -80,
              background:
                "radial-gradient(circle, rgba(255,255,255,0.6) 0%, transparent 70%)",
            }}
          />
          <div
            aria-hidden
            className="absolute rounded-full blur-3xl opacity-25"
            style={{
              width: 360,
              height: 360,
              bottom: -100,
              right: -80,
              background:
                "radial-gradient(circle, rgba(139,92,246,0.7) 0%, transparent 70%)",
            }}
          />
          {/* Subtle grid overlay */}
          <div
            aria-hidden
            className="absolute inset-0 opacity-[0.06]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }}
          />

          <div className="relative z-10 flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-white/15 ring-1 ring-white/30 backdrop-blur p-1.5 flex items-center justify-center">
              <Image
                src={LOGO_SRC}
                alt="SVBK"
                width={48}
                height={48}
                className="h-full w-full object-contain"
                priority
              />
            </div>
            <div className="leading-tight">
              <p className="text-sm font-semibold tracking-tight">SVBK</p>
              <p className="text-[11px] text-blue-200/80">School Console</p>
            </div>
          </div>

          <div className="relative z-10">
            <h2 className="text-3xl font-bold leading-[1.1] tracking-tight">
              Run your entire campus
              <br />
              from one console.
            </h2>
            <p className="mt-3 text-[15px] text-blue-100/90 max-w-sm leading-relaxed">
              Multi-tenant fees, payments, parents and students — built for
              Sri Venkateswara Bala Kuteer.
            </p>

            <div className="mt-8 flex flex-col gap-3">
              {FEATURES.map((f) => (
                <div key={f.title} className="flex items-start gap-3">
                  <div className="mt-0.5 h-6 w-6 rounded-md bg-white/15 ring-1 ring-white/20 flex items-center justify-center flex-shrink-0">
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                      <path
                        d="M3.5 8l3 3 6-6"
                        stroke="white"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="text-[14px] font-semibold leading-snug">
                      {f.title}
                    </p>
                    <p className="text-[12.5px] text-blue-200/75 leading-snug">
                      {f.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <p className="relative z-10 text-[11px] text-blue-200/60">
            © {new Date().getFullYear()} Sri Venkateswara Bala Kuteer · Guntur
          </p>
        </div>

        {/* RIGHT: form */}
        <div className="flex flex-col justify-center p-8 sm:p-12">
          {/* Mobile mini brand */}
          <div className="flex items-center gap-3 md:hidden mb-8">
            <div className="h-11 w-11 rounded-xl bg-slate-100 p-1.5">
              <Image
                src={LOGO_SRC}
                alt="SVBK"
                width={44}
                height={44}
                className="h-full w-full object-contain"
                priority
              />
            </div>
            <div className="leading-tight">
              <p className="text-sm font-bold text-slate-900">SVBK</p>
              <p className="text-[11px] text-slate-500">Admin Console</p>
            </div>
          </div>

          <LoginForm showBackLink={false} />
        </div>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <svg
      className="h-10 w-10 animate-spin"
      style={{ color: "#6c739c" }}
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}
