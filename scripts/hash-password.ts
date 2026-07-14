import { hashSync } from "bcryptjs";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

const ROUNDS = 12;

const rl = createInterface({ input: stdin, output: stdout });
const email = await rl.question("メールアドレス: ");
const password = await rl.question("パスワード: ");
const name = await rl.question("表示名（例: 渡邉）: ");
rl.close();

if (!email.includes("@")) {
  console.error("\nメールアドレスの形式が不正です。");
  process.exit(1);
}

if (password.length < 12) {
  console.error("\nパスワードは12文字以上にしてください。");
  process.exit(1);
}

// bcrypt ハッシュには "$" が含まれる。Next.js の .env パーサーは "$xxx" を変数展開
// してしまい値が壊れるため、base64 にしてから環境変数に入れる。
// この形なら .env.local と Vercel の両方で同じ値をそのまま使える。
const encoded = Buffer.from(hashSync(password, ROUNDS), "utf8").toString("base64");

const label = name.trim();

console.log("\nADMIN_USERS に追加する1件分です（複数人はカンマ区切りで並べます）:\n");
console.log(`${email.trim().toLowerCase()}:${encoded}${label ? `:${label}` : ""}`);
