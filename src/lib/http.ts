import "server-only";
import { Agent, fetch as undiciFetch } from "undici";

/**
 * 外部サービスへの HTTP。IPv4 に固定して繋ぐ。
 *
 * Vercel の関数から Perplexity を呼ぶと、本文が 1KB でも 100 秒応答が無い、
 * という状態になった（手元からは同じ要求が 1 秒未満で返る）。原因は Node の
 * fetch が使っている undici の接続の仕方にある。
 *
 *  - undici は自前で接続先を選ぶため、dns.setDefaultResultOrder("ipv4first") も
 *    --dns-result-order も効かない
 *  - 相手が IPv4 と IPv6 の両方を持つ場合、IPv6 を先に試す
 *  - そこで応答が無くても IPv4 へ落ちず、タイムアウトまで待ち続ける
 *
 * api.perplexity.ai は A と AAAA の両方を返す（Cloudflare 配下）。Vercel の
 * 関数から IPv6 で外へ出られないと、この待ちがそのまま失敗になる。
 *
 * 【重要】グローバルの fetch に dispatcher を渡しても効かない。Node 内蔵の
 * undici と、この依存として入れた undici は別物で、渡すと
 * `UND_ERR_INVALID_ARG: invalid onRequestStart method` で即座に落ちる。
 * 必ず undici 側の fetch と組で使うこと。
 *
 * 副次的な利点として、Next.js による fetch の差し替え（キャッシュ）も通らない。
 * 外部から取ってきた結果を勝手に使い回されると困る用途ばかりなので都合がよい。
 */
const ipv4Agent = new Agent({
  connect: { family: 4 },
});

export type ExternalResponse = Awaited<ReturnType<typeof undiciFetch>>;
export type ExternalRequestInit = Parameters<typeof undiciFetch>[1];

/** 外部サービスを叩く。呼び出し方は fetch と同じ。 */
export function fetchExternal(
  url: string,
  init: ExternalRequestInit = {}
): Promise<ExternalResponse> {
  return undiciFetch(url, { ...init, dispatcher: ipv4Agent });
}
