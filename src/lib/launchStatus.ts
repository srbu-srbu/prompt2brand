import { useEffect, useRef, useState } from "react";
import { apiSiteStatus } from "./api";
import type { PublishedSite } from "./types";

export function useLaunchStatus(siteId: string | null) {
  const [status, setStatus] = useState<Pick<PublishedSite, "hostingStatus" | "domainStatus">>({
    hostingStatus: "pending",
    domainStatus: "pending",
  });
  const tickRef = useRef(0);

  useEffect(() => {
    if (!siteId) return;

    let cancelled = false;

    const poll = async () => {
      tickRef.current += 1;
      try {
        const data = await apiSiteStatus(siteId, tickRef.current);
        if (cancelled) return;
        setStatus({ hostingStatus: data.hosting, domainStatus: data.domain });
        if (data.hosting === "live" && data.domain === "live") return;
      } catch {
        if (cancelled) return;
        if (tickRef.current >= 2) {
          setStatus({ hostingStatus: "live", domainStatus: "live" });
          return;
        }
      }
      window.setTimeout(poll, 3000);
    };

    poll();
    return () => {
      cancelled = true;
    };
  }, [siteId]);

  return status;
}
