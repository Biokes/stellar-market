"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import Link from "next/link";

export default function VerifyEmailTokenPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading",
  );
  const [message, setMessage] = useState("");

  useEffect(() => {
    const verifyEmail = async () => {
      const API =
        process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000/api";

      try {
        const response = await fetch(`${API}/auth/verify-email/${token}`, {
          method: "GET",
        });

        const data = await response.json();

        if (response.ok) {
          setStatus("success");
          setMessage(data.message || "Email verified successfully!");

          // Clear any pending verification email from localStorage
          localStorage.removeItem("pendingVerificationEmail");

          // Redirect to login after 3 seconds
          setTimeout(() => {
            router.push("/auth/login");
          }, 3000);
        } else {
          setStatus("error");
          setMessage(
            data.error ||
              "Verification failed. The link may be invalid or expired.",
          );
        }
      } catch (err: any) {
        // eslint-disable-line @typescript-eslint/no-explicit-any
        setStatus("error");
        setMessage(err.message || "An error occurred during verification.");
      }
    };

    if (token) {
      verifyEmail();
    }
  }, [token, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-theme-bg px-4">
      <div className="w-full max-w-md p-8 bg-theme-card border border-theme-border rounded-2xl shadow-xl text-center">
        {status === "loading" && (
          <>
            <Loader2
              size={64}
              className="mx-auto text-stellar-blue mb-4 animate-spin"
            />
            <h1 className="text-3xl font-bold text-theme-heading mb-2">
              Verifying Your Email
            </h1>
            <p className="text-theme-text">
              Please wait while we verify your email address...
            </p>
          </>
        )}

        {status === "success" && (
          <>
            <CheckCircle size={64} className="mx-auto text-green-500 mb-4" />
            <h1 className="text-3xl font-bold text-theme-heading mb-2">
              Email Verified!
            </h1>
            <p className="text-theme-text mb-6">{message}</p>
            <p className="text-sm text-theme-text mb-4">
              Redirecting to login page...
            </p>
            <Link
              href="/auth/login"
              className="inline-block btn-primary py-3 px-6 font-semibold"
            >
              Go to Login
            </Link>
          </>
        )}

        {status === "error" && (
          <>
            <XCircle size={64} className="mx-auto text-theme-error mb-4" />
            <h1 className="text-3xl font-bold text-theme-heading mb-2">
              Verification Failed
            </h1>
            <p className="text-theme-text mb-6">{message}</p>
            <div className="space-y-3">
              <Link
                href="/auth/verify-email"
                className="block w-full btn-secondary py-3 font-semibold"
              >
                Resend Verification Email
              </Link>
              <Link
                href="/auth/login"
                className="block w-full py-3 text-stellar-blue hover:underline font-medium"
              >
                Back to Login
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
