
# InsForge + OKX x402 Payments Integration Guide

OKX acts as the **x402 facilitator** for the x402 HTTP payment protocol. Your server returns `402 Payment Required` with a challenge; the client signs an EIP-3009 `TransferWithAuthorization`; the server forwards the signed payload to OKX's `/verify` and `/settle` endpoints. USDG on X Layer settles with zero gas (OKX pays the gas). Payment records and realtime dashboards live in InsForge.

## Key packages

- `@insforge/sdk` — InsForge client for DB writes and realtime subscription
- `viem` — EIP-712 typed data signing on the client
- No x402 SDK is required; the facilitator is plain REST

## Recommended Workflow

```text
1. Create OKX Web3 Dev Portal project  → web3.okx.com/onchainos/dev-portal (manual)
2. Create/link InsForge project        → npx @insforge/cli create or link
3. Create x402_payments table + trigger → insforge/migrations/*.sql
4. Install deps + configure env        → npm install viem, .env
5. Build OKX facilitator client        → src/lib/okx-facilitator.ts
6. Build x402 server primitives        → src/lib/x402.ts (challenge builder, header decoders)
7. Build x402 client primitives        → src/lib/x402-client.ts (wallet signing)
8. Add payment-gated endpoint          → server route returning 402 → verifying → delivering
9. Build realtime dashboard            → subscribe to x402_payments channel
```

## Dashboard setup (manual, cannot be automated)

### OKX Web3 API credentials

- Go to [OKX Onchain OS Dev Portal](https://web3.okx.com/onchainos/dev-portal) and connect your wallet
- Create a project, then link email + phone (required to enable API key creation)
- Create API Key → save **API Key**, **Secret Key**, and the **passphrase** you set (secret shown only once)
- **Do NOT reuse an OKX exchange trading API key** — it returns `Invalid Authority` (code 50114). The Web3 API is a separate system at `web3.okx.com/onchainos/dev-portal`, not `okx.com/account/my-api`

### Payment recipient wallet

- Any EVM address on X Layer (chainId 196) works as the payee
- If using OKX Wallet, copy the **0x-prefixed** address (not the `XKO...` native format)
- Fund the **paying** wallet (not the recipient) with USDG on X Layer for real settlements — OKX facilitator covers gas

### InsForge project

- Create via `npx @insforge/cli create` or link via `npx @insforge/cli link --project-id <id>`
- Get **URL**, **Anon Key**, and **Service Role Key** from dashboard → Project Settings → API Keys

## Chain + Asset constants (X Layer)

| Constant | Value |
|----------|-------|
| Chain ID | `196` |
| CAIP-2 network | `eip155:196` |
| USDG contract | `0x4ae46a509f6b1d9056937ba4500cb143933d2dc8` |
| EIP-712 domain name | `Global Dollar` (NOT `"USDG"`) |
| EIP-712 domain version | `1` (NOT `"2"`) |
| Decimals | 6 |

**Domain name/version are the most common source of `Invalid Authority` errors.** Verify by reading the contract's `DOMAIN_SEPARATOR` and comparing against candidates — the USDG contract on X Layer reports `name()` = `"Global Dollar"`, not `"USDG"`.

## Database schema

```sql
create table if not exists x402_payments (
  id uuid default gen_random_uuid() primary key,
  payer_address text not null,
  endpoint text not null,
  amount text not null,           -- smallest unit (6-decimal)
  tx_hash text not null unique,   -- UNIQUE prevents duplicate settlement records
  chain text default 'xlayer',
  status text default 'settled',
  response_summary text,
  created_at timestamptz default now()
);

create index if not exists idx_x402_payments_payer on x402_payments (payer_address);
create index if not exists idx_x402_payments_created on x402_payments (created_at desc);

-- Realtime channel + trigger for live dashboard
INSERT INTO realtime.channels (pattern, description, enabled)
VALUES ('x402_payments', 'Payment events for dashboard', true)
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION notify_x402_payment()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM realtime.publish(
    'x402_payments',
    'INSERT_x402_payments',
    jsonb_build_object('new', row_to_json(NEW))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER x402_payment_realtime
  AFTER INSERT ON x402_payments
  FOR EACH ROW
  EXECUTE FUNCTION notify_x402_payment();
```

## OKX facilitator client

The `/verify` and `/settle` endpoints require OKX HMAC authentication headers (same scheme as the OKX Web3 API).

```typescript
// src/lib/okx-facilitator.ts
import crypto from "crypto";

const OKX_BASE = "https://web3.okx.com/api/v6/x402";
const MOCK = process.env.MOCK_OKX_FACILITATOR === "true";

function signOKX(timestamp: string, method: string, path: string, body: string) {
  return crypto
    .createHmac("sha256", process.env.OKX_SECRET_KEY!)
    .update(timestamp + method + path + body)
    .digest("base64");
}

function okxHeaders(method: string, path: string, body: string): Record<string, string> {
  const timestamp = new Date().toISOString();
  return {
    "OK-ACCESS-KEY": process.env.OKX_API_KEY!,
    "OK-ACCESS-SIGN": signOKX(timestamp, method, path, body),
    "OK-ACCESS-PASSPHRASE": process.env.OKX_PASSPHRASE!,
    "OK-ACCESS-TIMESTAMP": timestamp,
    "Content-Type": "application/json",
  };
}

export async function verifyPayment(paymentPayload: unknown, paymentRequirements: unknown) {
  if (MOCK) return { isValid: true, payer: (paymentPayload as any)?.payload?.authorization?.from };
  const path = "/api/v6/x402/verify";
  const body = JSON.stringify({ x402Version: 1, chainIndex: "196", paymentPayload, paymentRequirements });
  const res = await fetch(OKX_BASE + "/verify", { method: "POST", headers: okxHeaders("POST", path, body), body });
  const json = await res.json();
  return json.data?.[0] ?? { isValid: false, invalidReason: json.msg ?? "unknown" };
}

export async function settlePayment(paymentPayload: unknown, paymentRequirements: unknown) {
  if (MOCK) {
    const payer = (paymentPayload as any)?.payload?.authorization?.from;
    return { success: true, txHash: "0x" + crypto.randomBytes(32).toString("hex"), payer };
  }
  const path = "/api/v6/x402/settle";
  const body = JSON.stringify({ x402Version: 1, chainIndex: "196", syncSettle: true, paymentPayload, paymentRequirements });
  const res = await fetch(OKX_BASE + "/settle", { method: "POST", headers: okxHeaders("POST", path, body), body });
  const json = await res.json();
  return json.data?.[0] ?? { success: false, errorReason: json.msg ?? "unknown" };
}
```

> **`MOCK_OKX_FACILITATOR=true`** skips real on-chain settlement and returns a mock `txHash`. Useful for local dev and demos where the paying wallet has no USDG. Never enable in production.

## x402 server primitives

```typescript
// src/lib/x402.ts
const ASSET = "0x4ae46a509f6b1d9056937ba4500cb143933d2dc8"; // USDG on X Layer

export function buildPaymentRequirements(endpointUrl: string) {
  return {
    scheme: "exact",
    maxAmountRequired: "1",        // 0.000001 USDG (6 decimals, smallest unit)
    resource: endpointUrl,
    description: "Premium API endpoint",
    mimeType: "application/json",
    payTo: process.env.PAYMENT_RECIPIENT ?? "0x0000000000000000000000000000000000000000",
    maxTimeoutSeconds: 300,
    asset: ASSET,
    extra: { name: "Global Dollar", version: "1" }, // EIP-712 domain (verified via on-chain DOMAIN_SEPARATOR)
  };
}

export function build402Response(paymentRequirements: ReturnType<typeof buildPaymentRequirements>) {
  const challenge = { x402Version: 1, accepts: [{ network: "eip155:196", ...paymentRequirements }] };
  return new Response(JSON.stringify({ error: "Payment required" }), {
    status: 402,
    headers: {
      "Content-Type": "application/json",
      "PAYMENT-REQUIRED": Buffer.from(JSON.stringify(challenge)).toString("base64"),
    },
  });
}

export function decodePaymentSignature(header: string) {
  return JSON.parse(Buffer.from(header, "base64").toString("utf-8"));
}

export function buildPaymentResponseHeader(settlement: { txHash: string; payer: string }) {
  return Buffer.from(JSON.stringify({
    success: true,
    transaction: settlement.txHash,
    network: "eip155:196",
    payer: settlement.payer,
  })).toString("base64");
}
```

## x402 client primitives (wallet signing)

```typescript
// src/lib/x402-client.ts
import { createWalletClient, custom, hexToBigInt, type WalletClient, type Address } from "viem";

const X_LAYER_CHAIN = {
  id: 196,
  name: "X Layer",
  nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.xlayer.tech"] } },
} as const;

const EIP3009_TYPES = {
  TransferWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
} as const;

export async function connectWallet(): Promise<WalletClient> {
  if (!window.ethereum) throw new Error("NO_WALLET");
  const client = createWalletClient({ chain: X_LAYER_CHAIN, transport: custom(window.ethereum) });
  await client.requestAddresses();
  // Switch or add X Layer if needed — omitted for brevity, see demo source
  return client;
}

export async function signPayment(challenge: any, walletClient: WalletClient): Promise<string> {
  const accept = challenge.accepts[0];
  if (!accept) throw new Error("Invalid challenge: accepts array is empty");
  const [account] = await walletClient.getAddresses();

  const nonceBytes = crypto.getRandomValues(new Uint8Array(32));
  const nonce = ("0x" + Array.from(nonceBytes).map(b => b.toString(16).padStart(2, "0")).join("")) as `0x${string}`;
  const validBefore = BigInt(Math.floor(Date.now() / 1000) + accept.maxTimeoutSeconds);

  const authorization = {
    from: account,
    to: accept.payTo as Address,
    value: hexToBigInt(("0x" + BigInt(accept.maxAmountRequired).toString(16)) as `0x${string}`),
    validAfter: BigInt(0),
    validBefore,
    nonce,
  };

  const signature = await walletClient.signTypedData({
    account,
    domain: {
      name: accept.extra.name,             // "Global Dollar"
      version: accept.extra.version,       // "1"
      chainId: 196,
      verifyingContract: accept.asset as Address,
    },
    types: EIP3009_TYPES,
    primaryType: "TransferWithAuthorization",
    message: authorization,
  });

  const paymentPayload = {
    x402Version: challenge.x402Version,
    scheme: accept.scheme,
    network: accept.network,
    payload: {
      signature,
      authorization: {
        from: account,
        to: accept.payTo,
        value: accept.maxAmountRequired,
        validAfter: "0",
        validBefore: validBefore.toString(),
        nonce,
      },
    },
  };

  return btoa(JSON.stringify(paymentPayload));
}
```

## Payment-gated endpoint pattern

```typescript
// src/app/api/report/route.ts (Next.js App Router)
import { verifyPayment, settlePayment } from "@/lib/okx-facilitator";
import { createServiceClient } from "@/lib/insforge";
import { buildPaymentRequirements, build402Response, decodePaymentSignature, buildPaymentResponseHeader } from "@/lib/x402";

export async function POST(req: Request) {
  const paymentRequirements = buildPaymentRequirements(req.url);
  const paymentSigHeader = req.headers.get("X-PAYMENT-SIGNATURE");

  if (!paymentSigHeader) return build402Response(paymentRequirements);

  const paymentPayload = decodePaymentSignature(paymentSigHeader);
  const verification = await verifyPayment(paymentPayload, paymentRequirements);
  if (!verification.isValid) {
    return Response.json({ error: "Payment invalid", reason: verification.invalidReason }, { status: 402 });
  }

  const settlement = await settlePayment(paymentPayload, paymentRequirements);
  if (!settlement.success) {
    return Response.json({ error: "Settlement failed", reason: settlement.errorReason }, { status: 500 });
  }

  // Record payment (always check insert errors — settlement has already happened on-chain)
  const insforge = createServiceClient();
  const { error: insertError } = await insforge.database.from("x402_payments").insert([{
    payer_address: settlement.payer,
    endpoint: "/api/report",
    amount: paymentRequirements.maxAmountRequired,
    tx_hash: settlement.txHash,
    status: "settled",
  }]);
  if (insertError) console.error("[x402] insert failed:", insertError, "tx:", settlement.txHash);

  return Response.json(
    { report: /* your paid content */, payment: settlement },
    { status: 200, headers: { "PAYMENT-RESPONSE": buildPaymentResponseHeader(settlement) } }
  );
}
```

## Realtime dashboard subscription

```typescript
// Client-side
import { createClient } from "@insforge/sdk";

const insforge = createClient({
  baseUrl: process.env.NEXT_PUBLIC_INSFORGE_URL,
  anonKey: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY,
});

await insforge.realtime.connect();
const { ok } = await insforge.realtime.subscribe("x402_payments");
if (!ok) console.error("subscribe failed");

insforge.realtime.on("INSERT_x402_payments", (payload) => {
  const newPayment = payload.new;
  // Update UI state — append to list, increment counters, animate row
});
```

## Environment variables

| Variable | Source |
|----------|--------|
| `OKX_API_KEY` | OKX Onchain OS Dev Portal (Web3 API, NOT exchange API) |
| `OKX_SECRET_KEY` | OKX Onchain OS Dev Portal |
| `OKX_PASSPHRASE` | Chosen by you when creating the API key |
| `PAYMENT_RECIPIENT` | Your EVM wallet address on X Layer (starts with `0x`) |
| `NEXT_PUBLIC_INSFORGE_URL` | InsForge Dashboard → Project Settings |
| `NEXT_PUBLIC_INSFORGE_ANON_KEY` | InsForge Dashboard → Project Settings |
| `INSFORGE_SERVICE_KEY` | InsForge Dashboard → Project Settings (server-only) |
| `MOCK_OKX_FACILITATOR` | `true` for local/demo; unset or `false` for production |

## Common Mistakes

| Mistake | Solution |
|---------|----------|
| ❌ Using OKX exchange trading API key | ✅ Create a separate Web3 API key at `web3.okx.com/onchainos/dev-portal` |
| ❌ EIP-712 domain `name: "USDG"` / `version: "2"` | ✅ Use `name: "Global Dollar"` / `version: "1"` — verified from on-chain `DOMAIN_SEPARATOR` |
| ❌ Missing `chainIndex: "196"` on `/verify` | ✅ Both `/verify` and `/settle` require `chainIndex` (get `50014 chainIndex not empty or should be numeric`) |
| ❌ Ignoring result of `insert(...)` after settlement | ✅ Always check `{ error }` — settlement has already taken money; a silent DB failure loses the record |
| ❌ `tx_hash text not null` without UNIQUE | ✅ Add `UNIQUE` to prevent duplicate records from retries |
| ❌ Hardcoding `xlayer` in explorer URL | ✅ Use `payment.chain` column so multi-chain support works later |
| ❌ `MOCK_OKX_FACILITATOR=true` in production | ✅ Demo mode only — removes on-chain guarantee |
