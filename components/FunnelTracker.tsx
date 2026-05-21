"use client";

import { useEffect, useRef } from "react";

// Fires a one-time "scroll" event once the visitor reads past the halfway point.
export default function FunnelTracker({
  visitorId,
  funnelId,
  pageId,
}: {
  visitorId: string;
  funnelId: string;
  pageId: string;
}) {
  const fired = useRef(false);

  useEffect(() => {
    function onScroll() {
      if (fired.current) return;
      const depth =
        (window.scrollY + window.innerHeight) /
        Math.max(document.body.scrollHeight, 1);
      if (depth >= 0.5) {
        fired.current = true;
        window.removeEventListener("scroll", onScroll);
        fetch("/api/track", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          keepalive: true,
          body: JSON.stringify({
            visitorId,
            funnelId,
            pageId,
            type: "scroll",
          }),
        }).catch(() => {});
      }
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [visitorId, funnelId, pageId]);

  return null;
}
