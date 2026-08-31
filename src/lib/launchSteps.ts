export type StepPhase = "waiting" | "active" | "done" | "failed";

export type LaunchStep = {
  text: string;
  phase: StepPhase;
};

export type HostingDomainStatus = "pending" | "live" | "failed";

export const LAUNCH_STEP_SLOTS = 3;

function padSteps(steps: LaunchStep[]): LaunchStep[] {
  const padded = [...steps];
  while (padded.length < LAUNCH_STEP_SLOTS) {
    padded.push({ text: "\u00a0", phase: "waiting" });
  }
  return padded.slice(0, LAUNCH_STEP_SLOTS);
}

export function hostingSteps(
  launching: boolean,
  status: HostingDomainStatus,
): LaunchStep[] {
  if (status === "failed") {
    return padSteps([
      { text: "Saving pages and brand kit", phase: "done" },
      { text: "Deploying to Vercel", phase: "failed" },
    ]);
  }

  if (launching) {
    return padSteps([
      { text: "Saving pages and brand kit", phase: "active" },
      { text: "Deploying to Vercel", phase: "waiting" },
      { text: "Live on the web", phase: "waiting" },
    ]);
  }

  if (status === "pending") {
    return padSteps([
      { text: "Saving pages and brand kit", phase: "done" },
      { text: "Deploying to Vercel", phase: "active" },
      { text: "Live on the web", phase: "waiting" },
    ]);
  }

  return padSteps([
    { text: "Saving pages and brand kit", phase: "done" },
    { text: "Deploying to Vercel", phase: "done" },
    { text: "Live on the web", phase: "done" },
  ]);
}

export function domainSteps(
  launching: boolean,
  status: HostingDomainStatus,
): LaunchStep[] {
  if (status === "failed") {
    return padSteps([
      { text: "Registering with name.com", phase: "done" },
      { text: "Pointing DNS to your site", phase: "failed" },
    ]);
  }

  if (launching) {
    return padSteps([
      { text: "Registering with name.com", phase: "active" },
      { text: "Pointing DNS to your site", phase: "waiting" },
      { text: "Domain connected", phase: "waiting" },
    ]);
  }

  if (status === "pending") {
    return padSteps([
      { text: "Registering with name.com", phase: "done" },
      { text: "Pointing DNS to your site", phase: "active" },
      { text: "Domain connected", phase: "waiting" },
    ]);
  }

  return padSteps([
    { text: "Registering with name.com", phase: "done" },
    { text: "Pointing DNS to your site", phase: "done" },
    { text: "Domain connected", phase: "done" },
  ]);
}

export function overallLaunchStatus(
  hosting: HostingDomainStatus,
  domain: HostingDomainStatus,
): HostingDomainStatus {
  if (hosting === "failed" || domain === "failed") return "failed";
  if (hosting === "live" && domain === "live") return "live";
  return "pending";
}
