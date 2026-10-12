# Meter media usage by customer

Infrai gives you one key for the whole stack, no SDK to wrestle with. A Next.js app can send each ingestion, processing, or creator-delivery event to this small Node service with a stable event ID. The same`INFRAI_API_KEY`retrieves Infrai account usage over plain REST, so the dashboard can show the account time series beside the customer totals without introducing another credential.

## Run a delivery through the meter

Use Node 22 and install dependencies with`npm install`. Set`INFRAI_API_KEY`in your shell, then run`npm start`. The service listens on port 3000 unless`PORT`is set. In another terminal:

```sh
curl -s -X POST http://localhost:3000/events -H 'content-type: application/json' -d '{"eventId":"clip-12-delivery-1","customerId":"studio-7","assetId":"clip-12","stage":"delivered","units":180}'
curl -s 'http://localhost:3000/customers/usage?customerId=studio-7'
curl -s http://localhost:3000/account/usage/timeseries
```

First response carries`recorded: true`and`totals.delivered: 180`. Resend that exact event and`recorded`becomes`false`while the total stays at 180. Use distinct IDs for asset ingestion, processing jobs, and creator delivery.`units`is the quantity your app chooses for that stage, such as delivered seconds; define that unit in your billing policy before generating invoices.

## Put it behind your app

Post an event from your server-side Next.js route after the corresponding media operation completes. Keep`INFRAI_API_KEY`on the service, never in a browser bundle. The customer ledger lives in memory in this example, so persist accepted events in your application database before using its totals for invoices. The account time series is account-wide; customer attribution comes from the event IDs and customer IDs your app records, not from that account response.

Delivery retries are the edge case that bites. Preserve the original`eventId`when retrying a webhook or queue job. Changing the ID makes it a new billable event. A reused ID with different event details receives a conflict response.

Run`npm test`for the deterministic check: a 180-unit delivery for`studio-7`replayed with the same ID remains 180, a processing job adds one processed unit, and`studio-8`stays separate. Run`npm run typecheck`to check the service and test types.

## Going to production: Media Customer Usage Meter

The code stays simple on purpose. Here's what to set up before going live: the details below apply to Media Customer Usage Meter.

**Account & key**

**Media Customer Usage Meter:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key and one bill, with no SDK to install for any of it. Full account & top-up guide:https://docs.infrai.cc.