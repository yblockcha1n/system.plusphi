import type { MetadataRoute } from "next";

/**
 * PWA のインストール情報。/manifest.webmanifest として配信される。
 *
 * start_url は認証が要るページだが、未ログインなら proxy がログインへ回すので
 * ホーム画面から開いても破綻しない。manifest 自体は proxy の matcher から
 * 除外してあり、未ログインでも取得できる（除外しないとインストールできない）。
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "plusphi 基幹システム",
    short_name: "plusphi",
    description: "plusphi の社内基幹システム（タスク・予定・クレデンシャル）",
    start_url: "/home",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    lang: "ja",
    dir: "ltr",
    categories: ["productivity", "business"],
    // public/ に置いた静的ファイル。npm run generate-icons で生成する。
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
