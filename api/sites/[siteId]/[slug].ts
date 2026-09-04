import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getPageHtml, getSiteById, getSitePageMeta } from "../../_lib/sites";
import { prepareFallbackHtml } from "../../../shared/internalLinks";

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

    const [html, pages] = await Promise.all([
      getPageHtml(siteId, slug),
      getSitePageMeta(siteId),
    ]);
    if (!html) {
      res.status(404).send("Page not found");
      return;
    }

    const servedHtml = pages.length > 0 ? prepareFallbackHtml(html, pages, siteId) : html;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=60");
    res.status(200).send(servedHtml);
  } catch (error) {
    console.error("serve page failed", error);
    res.status(500).send("Failed to load page");
  }
}
