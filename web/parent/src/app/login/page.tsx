"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { isAuthenticated } from "@/lib/auth";
import { sendOtp, type SendOtpResponse } from "@/lib/parent-portal";
import { apiErrorMessage } from "@/lib/api";
import { OtpModal } from "@/components/OtpModal";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showOtp, setShowOtp] = useState(false);
  const [otpMeta, setOtpMeta] = useState<SendOtpResponse | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (isAuthenticated()) {
      router.replace("/dashboard");
    }
  }, [router]);

  const validateEmail = (val: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setEmailError("Email address is required.");
      return;
    }
    if (!validateEmail(email)) {
      setEmailError("Please enter a valid email address.");
      return;
    }
    setEmailError(null);
    setSubmitting(true);
    try {
      const meta = await sendOtp(email.trim());
      setOtpMeta(meta);
      setShowOtp(true);
    } catch (err) {
      setEmailError(apiErrorMessage(err, "Could not send OTP. Try again."));
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerified = () => {
    router.push("/dashboard");
  };

  if (!mounted) return null;

  return (
    <>
      <div
        className="min-h-screen w-full flex items-center justify-center p-4 sm:p-8"
        style={{ backgroundColor: "#f1f5f9" }}
      >
        <div
          className="w-full max-w-[880px] overflow-hidden rounded-2xl bg-white flex flex-col md:flex-row"
          style={{
            boxShadow: "0 20px 60px -10px rgb(0 0 0 / 0.15), 0 4px 20px -4px rgb(0 0 0 / 0.08)",
          }}
        >
          {/* Left panel – logo / branding */}
          <div
            className="hidden md:flex flex-col items-center justify-center w-[45%] flex-shrink-0 relative overflow-hidden"
            style={{ background: "linear-gradient(145deg, #6c739c 0%, #565c82 100%)" }}
          >
            {/* Decorative circles */}
            <div
              className="absolute -top-16 -left-16 w-64 h-64 rounded-full opacity-10"
              style={{ backgroundColor: "#fff" }}
            />
            <div
              className="absolute -bottom-20 -right-12 w-80 h-80 rounded-full opacity-10"
              style={{ backgroundColor: "#fff" }}
            />

            <div className="relative z-10 flex flex-col items-center px-10 text-center">
              <div className="w-40 h-40 rounded-2xl overflow-hidden bg-white shadow-2xl mb-6 p-2">
                <Image
                  src="/svbk_logo.webp"
                  alt="SVBK Logo"
                  width={144}
                  height={144}
                  className="w-full h-full object-contain"
                  priority
                />
              </div>
              <h1 className="text-white text-2xl font-extrabold leading-tight">
                Parent Portal
              </h1>
              <p className="text-blue-200 text-sm mt-2 leading-relaxed">
                Sri Venkateswara<br />Bala Kuteer, Guntur
              </p>
              <div className="mt-8 flex flex-col gap-3 w-full max-w-[220px] text-left">
                {["Track fee payments", "Download receipts", "Manage multiple children"].map((f) => (
                  <div key={f} className="flex items-center gap-2.5 text-blue-100 text-sm">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <circle cx="8" cy="8" r="7" fill="rgba(255,255,255,0.2)"/>
                      <path d="M4.5 8l2.5 2.5 4.5-4.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    {f}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right panel – form */}
          <div className="flex-1 flex flex-col justify-center px-8 py-10 sm:px-12">
            {/* Mobile logo */}
            <div className="flex justify-center mb-6 md:hidden">
              <div className="w-20 h-20 rounded-xl overflow-hidden bg-white shadow-lg p-1.5 border border-slate-100">
                <Image
                  src="/svbk_logo.webp"
                  alt="SVBK Logo"
                  width={72}
                  height={72}
                  className="w-full h-full object-contain"
                  priority
                />
              </div>
            </div>

            <div className="max-w-sm w-full mx-auto">
              <h2 className="text-2xl font-extrabold text-slate-900 leading-tight">
                Welcome Back
              </h2>
              <p className="mt-1.5 text-slate-500 text-sm">
                Enter your registered email to continue
              </p>

              <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-5" noValidate>
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="parent-email"
                    className="text-sm font-semibold text-slate-700"
                  >
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="4" width="20" height="16" rx="2"/>
                        <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                      </svg>
                    </span>
                    <input
                      id="parent-email"
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (emailError) setEmailError(null);
                      }}
                      placeholder="you@example.com"
                      autoComplete="email"
                      aria-invalid={!!emailError}
                      className="h-12 w-full rounded-xl border pl-10 pr-4 text-sm outline-none transition-all"
                      style={{
                        borderColor: emailError ? "#dc2626" : "#cbd5e1",
                        backgroundColor: emailError ? "#fff5f5" : "#f8fafc",
                        boxShadow: "none",
                        color: "#0f172a",
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = "#6c739c";
                        e.currentTarget.style.boxShadow = "0 0 0 3px rgb(11 84 171 / 0.15)";
                        e.currentTarget.style.backgroundColor = "#fff";
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = emailError ? "#dc2626" : "#cbd5e1";
                        e.currentTarget.style.boxShadow = "none";
                        e.currentTarget.style.backgroundColor = emailError ? "#fff5f5" : "#f8fafc";
                      }}
                    />
                  </div>
                  {emailError && (
                    <p className="text-xs text-red-600 flex items-center gap-1.5" role="alert">
                      <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                        <circle cx="6.5" cy="6.5" r="6" stroke="#dc2626" strokeWidth="1.2"/>
                        <path d="M6.5 3.5v3.5M6.5 9v.5" stroke="#dc2626" strokeWidth="1.2" strokeLinecap="round"/>
                      </svg>
                      {emailError}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="h-12 w-full rounded-xl text-white font-bold text-sm tracking-wide transition-all hover:opacity-90 active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{ backgroundColor: "#6c739c" }}
                >
                  {submitting ? "Sending OTP…" : "Send OTP"}
                  {!submitting && (
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14M12 5l7 7-7 7"/>
                    </svg>
                  )}
                </button>
              </form>

              <p className="mt-8 text-center text-xs text-slate-400">
                &copy; {new Date().getFullYear()} Sri Venkateswara Bala Kuteer. All rights reserved.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* OTP Modal */}
      {showOtp && (
        <OtpModal
          email={email}
          demoMode={otpMeta?.demoMode}
          devOtp={otpMeta?.devOtp}
          onVerified={handleVerified}
          onClose={() => setShowOtp(false)}
        />
      )}
    </>
  );
}
