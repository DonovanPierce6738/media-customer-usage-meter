export type MediaEvent = {
  eventId: string;
  customerId: string;
  assetId: string;
  stage: "ingested" | "processed" | "delivered";
  units: number;
};

export class MediaMeter {
  private readonly events = new Map<string, MediaEvent>();

  record(event: MediaEvent) {
    const previous = this.events.get(event.eventId);
    if (previous) {
      if (JSON.stringify(previous) !== JSON.stringify(event)) {
        throw new Error("Event ID already belongs to a different event");
      }
      return { recorded: false, totals: this.totals(event.customerId) };
    }
    this.events.set(event.eventId, event);
    return { recorded: true, totals: this.totals(event.customerId) };
  }

  totals(customerId: string) {
    const totals = { ingested: 0, processed: 0, delivered: 0 };
    for (const event of this.events.values()) {
      if (event.customerId === customerId) totals[event.stage] += event.units;
    }
    return totals;
  }
}
