import "server-only";

// TRC20 payment verification against the public TronScan API. A reported
// transaction hash only counts if the chain shows a confirmed USDT transfer
// into our deposit address — the customer's word never moves money.

const USDT_TRC20 = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";

export type ChainCheck =
  // at: when the transfer actually happened on chain, ISO — the age policy
  // lives with the caller, the chain just states the fact.
  | { ok: true; usdt: number; from: string; at: string | null }
  // final: the chain has definitively ruled it out (wrong token, wrong
  // address, failed tx). Not final: unreachable or still confirming — retry.
  | { ok: false; final: boolean; reason: string };

type Transfer = {
  contract_address?: string;
  to_address?: string;
  from_address?: string;
  amount_str?: string | number;
  decimals?: number;
};

export async function checkTrc20Payment(txHash: string, depositAddress: string): Promise<ChainCheck> {
  if (!depositAddress) return { ok: false, final: false, reason: "No deposit address configured for this country" };

  let body: {
    hash?: string;
    confirmed?: boolean;
    contractRet?: string;
    timestamp?: number;
    trc20TransferInfo?: Transfer[];
    tokenTransferInfo?: Transfer;
  };
  try {
    const res = await fetch(
      `https://apilist.tronscanapi.com/api/transaction-info?hash=${encodeURIComponent(txHash)}`,
      { signal: AbortSignal.timeout(12_000), cache: "no-store" }
    );
    if (!res.ok) return { ok: false, final: false, reason: `Block explorer returned ${res.status}` };
    body = await res.json();
  } catch {
    return { ok: false, final: false, reason: "Block explorer unreachable" };
  }

  if (!body?.hash) return { ok: false, final: false, reason: "Transaction not found on chain yet" };
  if (body.contractRet && body.contractRet !== "SUCCESS")
    return { ok: false, final: true, reason: `Transaction failed on chain (${body.contractRet})` };
  if (!body.confirmed) return { ok: false, final: false, reason: "Waiting for chain confirmations" };

  const transfers: Transfer[] = Array.isArray(body.trc20TransferInfo)
    ? body.trc20TransferInfo
    : body.tokenTransferInfo
      ? [body.tokenTransferInfo]
      : [];
  const hit = transfers.find((t) => t.contract_address === USDT_TRC20 && t.to_address === depositAddress);
  if (!hit) {
    const isUsdt = transfers.some((t) => t.contract_address === USDT_TRC20);
    return {
      ok: false,
      final: true,
      reason: !isUsdt ? "Not a USDT (TRC20) transfer" : "Not sent to our deposit address",
    };
  }

  const usdt = Number(hit.amount_str) / 10 ** Number(hit.decimals ?? 6);
  if (!Number.isFinite(usdt) || usdt <= 0)
    return { ok: false, final: true, reason: "Could not read the transfer amount" };
  return {
    ok: true,
    usdt: Math.round(usdt * 100) / 100,
    from: hit.from_address ?? "",
    at: body.timestamp ? new Date(body.timestamp).toISOString() : null,
  };
}
