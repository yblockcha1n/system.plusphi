import "server-only";
import { lookup } from "node:dns/promises";
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

/**
 * 相手が社外の公開ホストか確かめてから叩く。
 *
 * ナレッジに貼れる URL は任意なので、fetchExternal をそのまま向けると
 * 社内向けのアドレスやクラウドのメタデータ（169.254.169.254）にこちらから
 * 繋ぎに行かせられる。og:image の URL のように、外部サイトが指定した先を
 * こちらが取りに行く経路もあるため、貼った本人だけの問題にもならない。
 *
 * 名前を引いてから宛先を見る。引き直しの隙（DNS rebinding）までは塞げないが、
 * 使うのはログイン済みの社内利用者だけなので、そこは割り切る。
 */
export async function fetchPublic(
  url: string,
  init: ExternalRequestInit = {}
): Promise<ExternalResponse> {
  const target = new URL(url);

  if (target.protocol !== "https:" && target.protocol !== "http:") {
    throw new Error(`扱えない形式の URL です: ${target.protocol}`);
  }

  const addresses = await lookup(target.hostname, { all: true, family: 4 });
  const blocked = addresses.find((entry) => isPrivateAddress(entry.address));

  if (blocked) {
    throw new Error(`社外向けでない宛先には繋ぎません (${target.hostname} → ${blocked.address})`);
  }

  return fetchExternal(url, init);
}

/**
 * 外に出ない IPv4 か。RFC 1918 の私設アドレスのほか、ループバック・リンクローカル
 * （クラウドのメタデータもここ）・CGNAT・試験用・マルチキャストも落とす。
 */
function isPrivateAddress(address: string): boolean {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) return true;

  const [a, b] = parts;

  return (
    a === 0 || // このネットワーク
    a === 10 || // 私設
    a === 127 || // ループバック
    (a === 100 && b >= 64 && b <= 127) || // CGNAT
    (a === 169 && b === 254) || // リンクローカル（メタデータ）
    (a === 172 && b >= 16 && b <= 31) || // 私設
    (a === 192 && b === 168) || // 私設
    (a === 192 && b === 0) || // IETF 用
    (a === 198 && (b === 18 || b === 19)) || // ベンチマーク用
    a >= 224 // マルチキャスト・将来用
  );
}
