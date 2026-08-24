import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getPageHtml, getSiteById } from "../../_lib/sites";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const siteId = typeof req.query.siteId === "string" ? req.query.siteId : "";
  const slug = typeof req.query.slug === "string" ? req.query.slug : "home";

  if (!siteId) {
    res.status(400).json({ error: "siteId is required" });
    return;
  }

  try {
    const site = await getSiteById(siteId);
    if (!site) {
      res.status(404).send("Site not found");
      return;
    }

    const html = await getPageHtml(siteId, slug);
    if (!html) {
      res.status(404).send("Page not found");
      return;
    }

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=60");
    res.status(200).send(html);
  } catch (error) {
    console.error("serve page failed", error);
    res.status(500).send("Failed to load page");
  }
}
