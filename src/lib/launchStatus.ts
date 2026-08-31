import { useEffect, useRef, useState } from "react";
import { apiSiteStatus } from "./api";
import type { PublishedSite } from "./types";

export function useLaunchStatus(siteId: string | null) {
  const [status, setStatus] = useState<
    Pick<PublishedSite, "hostingStatus" | "domainStatus"> & { hostedUrl: string | null }
  >({
    hostingStatus: "pending",
    domainStatus: "pending",
    hostedUrl: null,
  });
  const attemptsRef = useRef(0);

  useEffect(() => {
    if (!siteId) return;

    let cancelled = false;
    let timer: number | undefined;

    const poll = async () => {
      attemptsRef.current += 1;
      try {
        const data = await apiSiteStatus(siteId);
        if (cancelled) return;
        setStatus({
          hostingStatus: data.hosting,
          domainStatus: data.domain,
          hostedUrl: data.hostedUrl ?? null,
        });
        if (data.hosting === "live" && data.domain === "live") return;
      } catch {
        if (cancelled) return;
      }

      if (attemptsRef.current < 20) {
        timer = window.setTimeout(poll, 3000);
      }
    };

    poll();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [siteId]);

  return status;
}
