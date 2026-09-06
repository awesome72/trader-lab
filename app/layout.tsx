import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: "TraderLab",
  description: "매매 의사결정의 품질을 측정하고 훈련하는 개인 트레이더용 도구",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <div className="flex-1">{children}</div>
        <footer className="border-t px-6 py-3 text-center text-xs text-muted-foreground">
          본 서비스는 투자 교육 및 자기 훈련 도구이며, 투자자문·투자권유가
          아닙니다. 모든 투자 판단과 그 결과는 이용자 본인에게 귀속됩니다.
        </footer>
      </body>
    </html>
  );
}
