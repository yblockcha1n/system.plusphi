import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { RegisterServiceWorker } from "@/components/pwa/register-service-worker";
import { ThemeProvider } from "@/components/layout/theme-provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "plusphi 基幹システム",
  description: "plusphi の社内基幹システム",
  robots: { index: false, follow: false },
  applicationName: "plusphi",
  appleWebApp: {
    capable: true,
    title: "plusphi",
    // ホーム画面から起動したときにステータスバーへ内容が回り込まないようにする
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false, date: false, address: false, email: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // ノッチ端末で safe-area-inset-* を使えるようにする（ボトムナビの下端余白）
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ja"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      // next-themes が描画前に class="dark" を付けるため、
      // サーバーが返した HTML との差分を警告させない
      suppressHydrationWarning
    >
      <body className="min-h-full">
        <ThemeProvider>
          {children}
          <Toaster position="bottom-right" />
        </ThemeProvider>
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
