"use client";

import { Share2, Link as LinkIcon, Check } from "lucide-react";
import { useState, useCallback } from "react";
import { useToast } from "./Toast";

interface ShareButtonProps {
  title: string;
  text?: string;
  url?: string;
  className?: string;
}

export function ShareButton({ title, text, url, className }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const shareUrl = url || (typeof window !== "undefined" ? window.location.href : "");

  const handleShare = useCallback(async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text: text || title,
          url: shareUrl,
        });
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          console.error("Error sharing:", err);
        }
      }
    } else {
      // Fallback to clipboard
      try {
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        toast.success("Link copied to clipboard!");
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error("Error copying to clipboard:", err);
        toast.error("Failed to copy link");
      }
    }
  }, [title, text, shareUrl, toast]);

  return (
    <button
      onClick={handleShare}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg border border-theme-border hover:bg-theme-border/50 transition-colors text-sm font-medium text-theme-text ${className}`}
      aria-label="Share"
    >
      {copied ? (
        <Check size={18} className="text-green-500" />
      ) : (
        <Share2 size={18} />
      )}
      <span>{copied ? "Copied!" : "Share"}</span>
    </button>
  );
}
