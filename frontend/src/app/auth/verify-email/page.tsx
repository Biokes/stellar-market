"use client";

import { useState } from "react";
import { Mail, CheckCircle, Loader2 } from "lucide-react";
import Link from "next/link";

export default function VerifyEmailPage() {
  const [isResending, setIsResending] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [resendError, setResendError] = useState<string | null>(null);

  const handleResend = async () => {
    setIsResending(true);
    setResendMessage(null);
    setResendError(null);

    const email = localStorage.getItem("pendingVerificationEmail");
    if (!email) {
      setResendError("No email found. Please register again.");
      setIsResending(false);
      return;
    }

    const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000/api";

    try {
      const response = await fetch(`${API}/auth/resend-verification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to resend email");

      setResendMessage("Verification email sent! Please check your inbox.");
    } catch (err: any) {
      // eslint-disable-line @typescript-eslint/no-explicit-any
      setResendError(err.message);
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-theme-bg px-4">
      <div className="w-full max-w-md p-8 bg-theme-card border border-theme-border rounded-2xl shadow-xl text-center">
        <div className="mb-6">
          <Mail size={64} className="mx-auto text-stellar-blue mb-4" />
          <h1 className="text-3xl font-bold text-theme-heading mb-2">
            Check Your Email
          </h1>
          <p className="text-theme-text">
            We&apos;ve sent a verification link to your email address. Click the
            link to activate your account.
          </p>
        </div>

        <div className="space-y-4">
          <div className="p-4 bg-stellar-blue/10 border border-stellar-blue/20 rounded-lg">
            <CheckCircle size={24} className="mx-auto text-stellar-blue mb-2" />
            <p className="text-sm text-theme-text">
              Didn&apos;t receive the email? Check your spam folder or click the
              button below to resend.
            </p>
          </div>

          {resendMessage && (
            <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400 text-sm">
              {resendMessage}
            </div>
          )}

          {resendError && (
            <div className="p-3 bg-theme-error/10 border border-theme-error/20 rounded-lg text-theme-error text-sm">
              {resendError}
            </div>
          )}

          <button
            onClick={handleResend}
            disabled={isResending}
            className="w-full btn-secondary py-3 flex items-center justify-center gap-2 font-semibold"
          >
            {isResending ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                Sending...
              </>
            ) : (
              "Resend Verification Email"
            )}
          </button>

          <Link
            href="/auth/login"
            className="block w-full py-3 text-stellar-blue hover:underline font-medium"
          >
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
}
