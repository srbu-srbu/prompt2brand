import type { VercelRequest, VercelResponse } from "@vercel/node";

export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.status(200).json({
    ok: true,
    postgresUrl: Boolean(
      process.env.POSTGRES_URL ??
        process.env.DATABASE_URL ??
        process.env.POSTGRES_URL_NON_POOLING,
    ),
    envKeys: Object.keys(process.env).filter((key) =>
      /POSTGRES|DATABASE|NEON/i.test(key),
    ),
  });
}
