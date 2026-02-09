import express from "express";
import { Neutron } from "neutron-sdk";

export interface PaymentEvent {
  txnId: string;
  txnState: string;
  extRefId?: string;
  [key: string]: unknown;
}

type PaymentHandler = (event: PaymentEvent) => void;

/**
 * Start the webhook server that listens for incoming payment notifications.
 */
export function startWebhookServer(opts: {
  port: number;
  secret: string;
  onPayment: PaymentHandler;
}) {
  const app = express();

  // Need raw body for signature verification
  app.post(
    "/webhooks/neutron",
    express.raw({ type: "application/json" }),
    (req, res) => {
      const signature = req.headers["x-neutronpay-signature"] as
        | string
        | undefined;

      try {
        const event = Neutron.verifyWebhook(
          req.body,
          signature,
          opts.secret
        ) as PaymentEvent;

        console.log(
          `⚡ Webhook received: [${event.txnState}] txn=${event.txnId}`
        );

        res.status(200).send("OK");

        // Notify the agent
        if (event.txnState === "completed") {
          opts.onPayment(event);
        }
      } catch (err) {
        console.error("❌ Webhook verification failed:", (err as Error).message);
        res.status(401).send("Invalid signature");
      }
    }
  );

  // Health check
  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.listen(opts.port, () => {
    console.log(`🔔 Webhook server listening on port ${opts.port}`);
    console.log(`   POST http://localhost:${opts.port}/webhooks/neutron`);
  });

  return app;
}
