/**
 * パッチノートの下書きを作って plusphi へ投げる。
 *
 * GitHub Actions から実行する前提で、Node の標準機能だけで書いてある
 * （CI で npm install を挟まずに済ませたいため。tsx も型も使わない）。
 *
 * 流れ:
 *   1. アプリに「前回公開したときの HEAD」を聞く
 *   2. そこから現在までの コミット一覧 / 変更ファイル / 実際の差分 を集める
 *   3. Perplexity の Agent API に渡して日本語のパッチノートにしてもらう
 *   4. 下書きとしてアプリへ登録する（公開と通知は人が画面から行う）
 *
 * 必要な環境変数:
 *   APP_URL               例 https://null.plusphi.jp
 *   RELEASE_NOTES_SECRET  アプリ側の同名の環境変数と同じ値
 *   PERPLEXITY_API_KEY    Perplexity の API キー
 *   PERPLEXITY_MODEL      省略可。既定は perplexity/sonar
 */

import { execFileSync } from "node:child_process";

const APP_URL = required("APP_URL").replace(/\/$/, "");
const SECRET = required("RELEASE_NOTES_SECRET");
const API_KEY = required("PERPLEXITY_API_KEY");

/**
 * Agent API のモデル slug。"perplexity/" の接頭辞が要る。
 * perplexity/sonar-pro という slug は存在しないので注意
 * （正しい一覧は GET https://api.perplexity.ai/v1/models で取れる）。
 */
const MODEL = process.env.PERPLEXITY_MODEL || "perplexity/sonar";

/**
 * 差分の送信量。
 *
 * まとめて切り詰めると、git diff がパス順に出す都合で先頭のファイルだけを読ませて
 * 終わってしまう（実測で 3 コミット 87 ファイル 265,000 文字）。そこでファイルごとに
 * 上限を設け、全ファイルに少しずつ枠を配る。「何が変わったか」を掴むには
 * 各ファイルの冒頭が読めれば足りる。
 */
const MAX_DIFF_CHARS = 120_000;
const MAX_CHARS_PER_FILE = 4_000;

/** 差分から外すもの。生成物やロックファイルは読ませても情報が増えない。 */
const EXCLUDED = [
  ":(exclude)package-lock.json",
  ":(exclude)pnpm-lock.yaml",
  ":(exclude)yarn.lock",
  ":(exclude)*.svg",
  ":(exclude)*.png",
  ":(exclude)*.ico",
  ":(exclude)tsconfig.tsbuildinfo",
];

function required(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`環境変数 ${name} が設定されていません。`);
    process.exit(1);
  }
  return value;
}

function git(args) {
  return execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).trim();
}

/** そのコミットが実在するか。CI の取得深度が足りないと存在しないことがある。 */
function exists(sha) {
  if (!sha || /^0+$/.test(sha)) return false;
  try {
    git(["cat-file", "-e", `${sha}^{commit}`]);
    return true;
  } catch {
    return false;
  }
}

async function callApp(path, init = {}) {
  const response = await fetch(`${APP_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${SECRET}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });

  const text = await response.text();

  if (!response.ok) {
    // 本文が HTML（＝ Next.js のエラーページ）だと数万文字になる。
    // ログを埋めても読めないので頭だけ出す。
    const detail = text.trimStart().startsWith("<")
      ? `${text.slice(0, 200)}…（HTML が返っています）`
      : text;

    throw new Error(`アプリへの ${path} が失敗しました (HTTP ${response.status}): ${detail}`);
  }

  return text ? JSON.parse(text) : null;
}

/** 待ち時間。デプロイ完了までの猶予。 */
const DEPLOY_WAIT_MS = 6 * 60 * 1000;
const RETRY_INTERVAL_MS = 15 * 1000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * アプリに新しいコードが乗るまで待つ。
 *
 * この workflow は push と同時に走るが、Vercel のデプロイが終わるのは
 * その 1〜2 分後。先に叩くと、まだ古いデプロイに当たって
 * /api/release-notes が 404（Next.js のエラーページ）を返す。
 *
 * 404 は「まだ来ていない」とみなして待ち、401 は合言葉の不一致なので
 * 待っても直らない＝即座に諦める。
 */
async function waitForApp() {
  const deadline = Date.now() + DEPLOY_WAIT_MS;
  let attempt = 0;

  for (;;) {
    attempt += 1;

    let response;

    try {
      response = await fetch(`${APP_URL}/api/release-notes`, {
        headers: { Authorization: `Bearer ${SECRET}` },
      });
    } catch (cause) {
      // 名前解決の失敗など。素の "fetch failed" だけだと原因が分からない。
      throw new Error(
        `${APP_URL} へ接続できませんでした（${cause.message}）。` +
          "GitHub Secrets の APP_URL が正しいか確認してください。"
      );
    }

    if (response.ok) {
      const { baseSha } = await response.json();
      if (attempt > 1) console.log(`デプロイの反映を確認しました（${attempt} 回目）。`);
      return baseSha ?? null;
    }

    if (response.status === 401) {
      throw new Error(
        "アプリに拒否されました (401)。GitHub の RELEASE_NOTES_SECRET と " +
          "Vercel の環境変数が一致しているか、環境変数の設定後に再デプロイしたかを確認してください。"
      );
    }

    if (response.status !== 404 && response.status < 500) {
      throw new Error(`アプリへの問い合わせが失敗しました (HTTP ${response.status})。`);
    }

    if (Date.now() >= deadline) {
      throw new Error(
        `${Math.round(DEPLOY_WAIT_MS / 60000)} 分待ちましたが /api/release-notes が現れませんでした ` +
          `(最後の応答: HTTP ${response.status})。デプロイが失敗しているか、` +
          "APP_URL が正しくない可能性があります。"
      );
    }

    console.log(
      `まだデプロイが反映されていません (HTTP ${response.status})。${RETRY_INTERVAL_MS / 1000} 秒後に再試行します。`
    );
    await sleep(RETRY_INTERVAL_MS);
  }
}

/* --------------------------- 差分を集める --------------------------- */

function collect(baseSha) {
  const head = git(["rev-parse", "HEAD"]);

  // 起点が分からない / 取得できていない場合は直近 10 コミットで代替する
  const base = exists(baseSha) ? baseSha : safeFallbackBase();
  const range = base ? `${base}..${head}` : head;

  const commits = git(["log", range, "--no-merges", "--pretty=format:- %s"])
    .split("\n")
    .filter(Boolean);

  const stat = git(["diff", "--stat", range, "--", ".", ...EXCLUDED]);
  const { diff, truncated, files } = collectDiff(range);

  return { base, head, commits, stat, diff, truncated, files };
}

/**
 * ファイルごとに枠を配って差分を集める。
 *
 * 1 ファイルぶんが長すぎるときは冒頭だけを取る。全体の枠を使い切ったら、
 * 残りはファイル名だけを伝える（何も伝えないより手掛かりになる）。
 */
function collectDiff(range) {
  const paths = git(["diff", "--name-only", range, "--", ".", ...EXCLUDED])
    .split("\n")
    .filter(Boolean);

  const chunks = [];
  const skipped = [];
  let total = 0;
  let truncated = false;

  for (const path of paths) {
    if (total >= MAX_DIFF_CHARS) {
      skipped.push(path);
      truncated = true;
      continue;
    }

    let piece = git(["diff", range, "--", path]);

    if (piece.length > MAX_CHARS_PER_FILE) {
      piece = `${piece.slice(0, MAX_CHARS_PER_FILE)}\n… (このファイルの差分は途中まで)`;
      truncated = true;
    }

    chunks.push(piece);
    total += piece.length;
  }

  if (skipped.length > 0) {
    chunks.push(`\n# 枠が尽きたため差分を省いたファイル\n${skipped.join("\n")}`);
  }

  return { diff: chunks.join("\n"), truncated, files: paths.length };
}

function safeFallbackBase() {
  try {
    return git(["rev-parse", "HEAD~10"]);
  } catch {
    // 履歴が 10 個も無い（初回など）
    return null;
  }
}

/* --------------------------- 本文を作る --------------------------- */

const INSTRUCTIONS = `あなたは社内向け業務システムのリリース担当です。
与えられた Git の変更内容を読み、社内の利用者（エンジニアではない人を含む）向けの
パッチノートを日本語で書いてください。

守ること:
- コミットメッセージをそのまま並べない。実際のコード変更から「利用者にとって何が
  変わるか」を読み取って書く。
- 見出しは「新機能」「改善」「修正」の3つだけ使い、該当が無い見出しは省く。
- 各項目は「・」で始め、1項目1行、80文字以内。
- 内部的なリファクタリング、依存関係の更新、フォーマット修正など利用者に影響しない
  変更は書かない。書くことが無ければ「・内部の整理を行いました」の1行だけにする。
- ファイル名、関数名、変数名、コミットハッシュは書かない。
- 推測で機能を書かない。差分から読み取れることだけを書く。
- 前置きや後書き、絵文字、Markdownの記号（#や*）は使わない。

出力は次の形式のJSONのみ。前後に説明を付けないこと。
{"title":"この更新を一言で表す見出し（40文字以内）","body":"新機能\\n・...\\n\\n改善\\n・..."}`;

async function generate({ commits, stat, diff, truncated }) {
  const input = [
    "# コミット一覧",
    commits.length > 0 ? commits.join("\n") : "(なし)",
    "",
    "# 変更ファイル",
    stat || "(なし)",
    "",
    "# 差分",
    truncated ? "(長いため途中で切っています)" : "",
    "```diff",
    diff || "(なし)",
    "```",
  ].join("\n");

  const response = await fetch("https://api.perplexity.ai/v1/agent", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      instructions: INSTRUCTIONS,
      input,
      // tools を渡さなければ web 検索は走らない。差分の要約に検索は不要で、
      // 付けると無関係な情報が混ざるうえ課金と待ち時間が増える。
      max_output_tokens: 1500,
    }),
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(`Perplexity への要求が失敗しました (HTTP ${response.status}): ${text}`);
  }

  const payload = JSON.parse(text);

  // HTTP 200 でも中で失敗していることがあるため、status を必ず見る
  if (payload.status && payload.status !== "completed") {
    throw new Error(`Perplexity の応答が未完了です (status=${payload.status}): ${text}`);
  }

  return parseAnswer(readOutputText(payload));
}

/** 応答本文を取り出す。output_text が無ければ output[] を辿る。 */
function readOutputText(payload) {
  if (typeof payload.output_text === "string" && payload.output_text.trim() !== "") {
    return payload.output_text;
  }

  const chunks = [];

  for (const item of payload.output ?? []) {
    for (const content of item.content ?? []) {
      if (typeof content.text === "string") chunks.push(content.text);
    }
  }

  if (chunks.length === 0) {
    throw new Error(`Perplexity の応答から本文を取り出せませんでした: ${JSON.stringify(payload)}`);
  }

  return chunks.join("\n");
}

/**
 * JSON を取り出す。前後に説明を付けてくる場合に備え、最初の { から最後の } までを拾う。
 * それでも読めなければ、本文をそのまま使って処理を止めない。
 */
function parseAnswer(raw) {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");

  if (start !== -1 && end > start) {
    try {
      const parsed = JSON.parse(raw.slice(start, end + 1));
      if (typeof parsed.title === "string" && typeof parsed.body === "string") {
        return { title: parsed.title.trim(), body: parsed.body.trim() };
      }
    } catch {
      // 下の素通しへ
    }
  }

  console.warn("JSON として読めなかったため、応答をそのまま本文にします。");
  return { title: "システムを更新しました", body: raw.trim() };
}

/* -------------------------------- 実行 -------------------------------- */

/**
 * 日付ベースの版番号（JST）。
 *
 * 未公開の下書きは常に 1 件で作り直されるため、同じ日に何度 push しても
 * 連番は要らない。公開のたびに日付が進む形になる。
 */
function versionLabel() {
  const jst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return `v${jst.toISOString().slice(0, 10).replace(/-/g, ".")}`;
}

async function main() {
  // デプロイが終わるまで待ってから、差分の起点を受け取る
  const baseSha = await waitForApp();
  const collected = collect(baseSha);

  if (collected.commits.length === 0 && collected.diff === "") {
    console.log("前回から変更がありません。何もしません。");
    return;
  }

  console.log(`対象: ${collected.base ?? "(履歴の先頭)"} .. ${collected.head}`);
  console.log(
    `コミット ${collected.commits.length} 件 / ${collected.files} ファイル / ` +
      `差分 ${collected.diff.length.toLocaleString()} 文字` +
      (collected.truncated ? "（一部省略）" : "")
  );

  const { title, body } = await generate(collected);

  await callApp("/api/release-notes", {
    method: "POST",
    body: JSON.stringify({
      version: versionLabel(),
      title,
      body,
      baseSha: collected.base,
      headSha: collected.head,
      commitCount: collected.commits.length,
      generatedBy: MODEL,
    }),
  });

  console.log(`下書きを登録しました: ${title}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
