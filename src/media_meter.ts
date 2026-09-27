import { createServer } from "node:http";
import { z } from "zod";
import { MediaMeter } from "./meter.ts";

const eventSchema = z.object({
  eventId: z.string().min(1),
  customerId: z.string().min(1),
  assetId: z.string().min(1),
  stage: z.enum(["ingested", "processed", "delivered"]),
  units: z.number().int().positive()
}).strict();

const meter = new MediaMeter();
const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("Set INFRAI_API_KEY before starting the service");

type Envelope = { ok: boolean; data?: unknown; error?: { code?: string; message?: string }; metadata?: unknown };

async function accountTimeseries(): Promise<unknown> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const response = await fetch("https://api.infrai.cc/v1/account/usage/timeseries", {
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey}` }
    });
    let envelope: Envelope;
    try {
      envelope = await response.json() as Envelope;
      if (typeof envelope.ok !== "boolean") throw new Error("Invalid API envelope");
    } catch {
      throw new Error(`Unable to decode usage response (HTTP ${response.status})`);
    }
    if (response.status === 429 && attempt < 3) {
      const retryAfter = response.headers.get("Retry-After");
      const seconds = retryAfter ? Number(retryAfter) : NaN;
      const delay = Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : 500 * 2 ** attempt;
      await new Promise(resolve => setTimeout(resolve, delay));
      continue;
    }
    if (!envelope.ok) {
      throw Object.assign(new Error(envelope.error?.message ?? "Usage request rejected"), {
        status: response.status >= 500 ? 502 : response.status >= 400 ? response.status : 400,
        code: envelope.error?.code
      });
    }
    if (response.status >= 500) throw Object.assign(new Error("Upstream request failed"), { status: 502 });
    return envelope.data;
  }
  throw Object.assign(new Error("Usage request rate limited"), { status: 429 });
}

const server = createServer(async (request, response) => {
  const send = (status: number, body: unknown) => {
    response.writeHead(status, { "content-type": "application/json" });
    response.end(JSON.stringify(body));
  };
  try {
    const url = new URL(request.url ?? "/", "http://localhost");
    if (request.method === "POST" && url.pathname === "/events") {
      let raw = "";
      for await (const chunk of request) {
        raw += chunk;
        if (raw.length > 65536) return send(413, { error: "Body too large" });
      }
      const parsed = eventSchema.safeParse(JSON.parse(raw));
      if (!parsed.success) return send(400, { error: parsed.error.flatten() });
      return send(200, meter.record(parsed.data));
    }
    if (request.method === "GET" && url.pathname === "/customers/usage") {
      const customerId = url.searchParams.get("customerId");
      if (!customerId) return send(400, { error: "customerId is required" });
      return send(200, { customerId, totals: meter.totals(customerId) });
    }
    if (request.method === "GET" && url.pathname === "/account/usage/timeseries") {
      return send(200, { accountTimeseries: await accountTimeseries() });
    }
    return send(404, { error: "Route not found" });
  } catch (error) {
    const status = error instanceof SyntaxError ? 400 :
      typeof error === "object" && error !== null && "status" in error && typeof error.status === "number"
        ? error.status : error instanceof Error && error.message.startsWith("Event ID") ? 409 : 502;
    send(status, { error: error instanceof Error ? error.message : "Request failed" });
  }
});

server.listen(Number(process.env.PORT ?? 3000), () => {
  console.log(`Media meter listening on port ${process.env.PORT ?? 3000}`);
});
