import assert from "node:assert/strict";
import test from "node:test";
import { MediaMeter } from "../src/meter.ts";

test("a delivery replay does not double bill a creator's customer", () => {
  const meter = new MediaMeter();
  const event = { eventId: "delivery-42", customerId: "studio-7", assetId: "clip-12", stage: "delivered" as const, units: 180 };
  assert.equal(meter.record(event).recorded, true);
  assert.equal(meter.record(event).recorded, false);
  meter.record({ eventId: "job-42", customerId: "studio-7", assetId: "clip-12", stage: "processed", units: 1 });
  meter.record({ eventId: "delivery-43", customerId: "studio-8", assetId: "clip-12", stage: "delivered", units: 60 });
  assert.deepEqual(meter.totals("studio-7"), { ingested: 0, processed: 1, delivered: 180 });
  assert.throws(() => meter.record({ ...event, units: 200 }), /different event/);
});
