import { useLaunchStatus } from "@/lib/launchStatus";
import type { PublishedSite } from "@/lib/types";
import { cn } from "@/lib/utils";

type DoneScreenProps = {
  published: PublishedSite & { siteId: string };
};

function StatusDot({ status }: { status: "pending" | "live" | "failed" }) {
  return (
    <span
      className={cn(
        "inline-block h-2 w-2 rounded-full",
        status === "live" && "bg-emerald-500",
        status === "pending" && "bg-amber-400",
        status === "failed" && "bg-red-500",
      )}
      aria-hidden
    />
  );
}

export function DoneScreen({ published }: DoneScreenProps) {
  const status = useLaunchStatus(published.siteId);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-zinc-900">Your brand is launching</h1>
        <p className="mt-2 text-sm text-zinc-500">Links will become live as hosting and DNS finish.</p>

        <div className="mt-8 space-y-4">
          <div className="flex items-center gap-3">
            <StatusDot status={status.hostingStatus} />
            <a
              href={published.hostedUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-medium text-zinc-900 underline-offset-2 hover:underline"
            >
              {published.hostedUrl}
            </a>
            <span className="text-xs capitalize text-zinc-500">{status.hostingStatus}</span>
          </div>
          <div className="flex items-center gap-3">
            <StatusDot status={status.domainStatus ?? "pending"} />
            <a
              href={`https://${published.domainFqdn}`}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-medium text-zinc-900 underline-offset-2 hover:underline"
            >
              {published.domainFqdn}
            </a>
            <span className="text-xs capitalize text-zinc-500">{status.domainStatus ?? "pending"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
