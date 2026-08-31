import { detectDomainIntent } from "./intent";

export function detectIntent(prompt: string): "site" | "domain" {
  return detectDomainIntent(prompt);
}

export function buildSummary(intent: "site" | "domain", prompt: string): [string, string, string] {
  if (intent === "domain") {
    return [
      "No domain suggestions available.",
      `Keywords: ${prompt.slice(0, 60)}`,
      "Try different keywords or a shorter brand name.",
    ];
  }
  return [
    "Updated site from your prompt.",
    `Latest cue: ${prompt.slice(0, 60)}`,
    "Open the domain tab when you're ready to pick a name.",
  ];
}
