/**
 * 会社名の表記ゆれを吸収して照合する。
 *
 * OCR や vCard で読めた会社名をそのまま新規登録すると、「株式会社プラスファイ」と
 * 「(株)プラスファイ」が別の取引先として並んでしまう。候補を出して人に選ばせる
 * ための下ごしらえ。
 *
 * 依存を持たない純粋関数だけにしてある（照合の当たり外れは実際に動かして
 * 確かめたいため）。
 */

/** 法人格の表記。前株・後株どちらの位置に出ても落とす。 */
const LEGAL_FORMS =
  /株式会社|有限会社|合同会社|合資会社|合名会社|一般社団法人|一般財団法人|公益社団法人|公益財団法人|特定非営利活動法人|\(株\)|（株）|\(有\)|（有）|㈱|㈲/g;

/** 比較で無視する記号と空白。中黒やハイフンの有無で別物にしない。 */
const NOISE = /[\s　・,、.。\-ー−–—_/\\|()（）「」『』【】]/g;

/**
 * 比較用にならす。
 * 「株式会社プラスファイ」「(株)プラスファイ」「プラスファイ」がすべて同じになる。
 */
export function normalizeCompanyName(value: string): string {
  return (
    value
      .trim()
      // 全角の英数字を半角へ（ＡＢＣ商事 と ABC商事 を同じにする）
      .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (char) =>
        String.fromCharCode(char.charCodeAt(0) - 0xfee0)
      )
      .toLowerCase()
      .replace(LEGAL_FORMS, "")
      .replace(NOISE, "")
  );
}

/**
 * 同じ会社とみなせるか。
 *
 * 片方がもう片方を含んでいれば同じとみなす（「プラスファイ」と
 * 「プラスファイデザイン」のような部分一致も候補に出したいため）。
 * ただし短すぎる名前は何にでも当たってしまうので、完全一致だけを認める。
 */
export function looksLikeSameCompany(a: string, b: string): boolean {
  const left = normalizeCompanyName(a);
  const right = normalizeCompanyName(b);

  if (left === "" || right === "") return false;
  if (left === right) return true;

  // 2 文字以下だと「ABC」の中の「AB」のような偶然の一致が増える
  const shorter = left.length <= right.length ? left : right;
  if (shorter.length <= 2) return false;

  return left.includes(right) || right.includes(left);
}
