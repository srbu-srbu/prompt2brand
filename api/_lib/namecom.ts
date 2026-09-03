type NamecomConfig = {
  user: string;
  token: string;
  baseUrl: string;
  environment: "sandbox" | "production";
};

export type NamecomSearchResult = {
  domainName: string;
  purchasable: boolean;
  premium?: boolean;
  purchasePrice?: number;
  purchaseType?: string;
};

type SearchResponse = {
  results?: NamecomSearchResult[];
};

type AvailabilityResponse = {
  results?: NamecomSearchResult[];
};

import { namecomEnvironment } from "./integrations";

export function getNamecomConfig(): NamecomConfig | null {
  const environment = namecomEnvironment();
  const production = environment === "production";

  const user = production
    ? process.env.NAMECOM_PRODUCTION_USER?.trim()
    : process.env.NAMECOM_SANDBOX_USER?.trim();
  const token = production
    ? process.env.NAMECOM_PRODUCTION_TOKEN?.trim()
    : process.env.NAMECOM_SANDBOX_TOKEN?.trim();
  const defaultUrl = production ? "https://api.name.com" : "https://api.dev.name.com";
  const baseUrl =
    (production ? process.env.NAMECOM_PRODUCTION_URL : process.env.NAMECOM_SANDBOX_URL)?.trim() ||
    defaultUrl;

  if (user && token) {
    return { user, token, baseUrl, environment };
  }

  const legacyUser = process.env.NAMECOM_API_USER?.trim();
  const legacyToken = process.env.NAMECOM_API_TOKEN?.trim();
  if (legacyUser && legacyToken) {
    return {
      user: legacyUser,
      token: legacyToken,
      baseUrl: process.env.NAMECOM_API_URL?.trim() || "https://api.dev.name.com",
      environment: "sandbox",
    };
  }

  return null;
}

export function hasNamecomConfig(): boolean {
  return getNamecomConfig() !== null;
}

function authHeader(config: NamecomConfig): string {
  const encoded = Buffer.from(`${config.user}:${config.token}`).toString("base64");
  return `Basic ${encoded}`;
}

export async function namecomFetch<T>(
  path: string,
  init: RequestInit & { config?: NamecomConfig } = {},
): Promise<T> {
  const config = init.config ?? getNamecomConfig();
  if (!config) {
    throw new Error("name.com credentials are required for the active integration mode");
  }

  const headers = new Headers(init.headers);
  headers.set("Authorization", authHeader(config));
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${config.baseUrl}${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`name.com ${response.status}: ${text || response.statusText}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function searchDomains(input: {
  keyword: string;
  tldFilter?: string[];
  timeoutMs?: number;
}): Promise<NamecomSearchResult[]> {
  const data = await namecomFetch<SearchResponse>("/core/v1/domains:search", {
    method: "POST",
    body: JSON.stringify({
      keyword: input.keyword,
      purchaseType: "registration",
      timeout: input.timeoutMs ?? 8000,
      ...(input.tldFilter?.length ? { tldFilter: input.tldFilter } : {}),
    }),
  });

  return data.results ?? [];
}

export async function checkDomainAvailability(domainNames: string[]): Promise<NamecomSearchResult[]> {
  const data = await namecomFetch<AvailabilityResponse>("/core/v1/domains:checkAvailability", {
    method: "POST",
    body: JSON.stringify({
      domainNames,
      purchaseType: "registration",
    }),
  });

  return data.results ?? [];
}

function registrationYearsForFqdn(fqdn: string): number {
  const tld = fqdn.split(".").pop()?.toLowerCase() ?? "";
  // name.com defaults to 2-year minimum for .ai registrations.
  if (tld === "ai") return 2;
  return 1;
}

export async function createDomain(input: {
  fqdn: string;
  purchasePrice?: number;
  premium?: boolean;
  purchaseType?: string;
  idempotencyKey: string;
}): Promise<void> {
  const body: Record<string, unknown> = {
    domain: { domainName: input.fqdn },
    years: registrationYearsForFqdn(input.fqdn),
    purchaseType: input.purchaseType ?? "registration",
  };

  if (input.premium && input.purchasePrice != null) {
    body.purchasePrice = input.purchasePrice;
  }

  await namecomFetch("/core/v1/domains", {
    method: "POST",
    headers: {
      "X-Idempotency-Key": input.idempotencyKey,
    },
    body: JSON.stringify(body),
  });
}

export async function createDnsRecord(input: {
  fqdn: string;
  host: string;
  type: "A" | "CNAME" | "TXT";
  answer: string;
}): Promise<void> {
  await namecomFetch(`/core/v1/domains/${encodeURIComponent(input.fqdn)}/records`, {
    method: "POST",
    body: JSON.stringify({
      host: input.host,
      type: input.type,
      answer: input.answer,
      ttl: 300,
    }),
  });
}

async function purchaseDomain(input: {
  fqdn: string;
  idempotencyKey: string;
}): Promise<void> {
  const availability = await checkDomainAvailability([input.fqdn]);
  const match = availability.find((row) => row.domainName === input.fqdn) ?? availability[0];

  if (!match?.purchasable) {
    throw new Error(`Domain ${input.fqdn} is not available for registration`);
  }

  if (match.purchaseType && match.purchaseType !== "registration") {
    throw new Error(`Domain ${input.fqdn} has unsupported purchase type ${match.purchaseType}`);
  }

  await createDomain({
    fqdn: input.fqdn,
    premium: match.premium,
    purchasePrice: match.purchasePrice,
    purchaseType: match.purchaseType,
    idempotencyKey: input.idempotencyKey,
  });
}

export async function applyDnsRecords(
  fqdn: string,
  records: Array<{ host: string; type: "A" | "CNAME" | "TXT"; answer: string }>,
): Promise<void> {
  for (const record of records) {
    await createDnsRecord({ fqdn, ...record });
  }
}

export async function registerDomainWithRecords(input: {
  fqdn: string;
  idempotencyKey: string;
  records: Array<{ host: string; type: "A" | "CNAME"; answer: string }>;
}): Promise<void> {
  await purchaseDomain({ fqdn: input.fqdn, idempotencyKey: input.idempotencyKey });
  await applyDnsRecords(input.fqdn, input.records);
}

export async function registerDomainWithDns(input: {
  fqdn: string;
  hostedUrl: string;
  idempotencyKey: string;
}): Promise<void> {
  await purchaseDomain({ fqdn: input.fqdn, idempotencyKey: input.idempotencyKey });

  const targetHost = new URL(input.hostedUrl).hostname;
  const cnameTarget = targetHost.endsWith(".") ? targetHost : `${targetHost}.`;

  await createDnsRecord({
    fqdn: input.fqdn,
    host: "www",
    type: "CNAME",
    answer: cnameTarget,
  });
}
