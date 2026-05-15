import type { Metadata } from "next";
import { Inter, Geist } from "next/font/google";
import { AuthProvider } from "./auth-provider";
import "./globals.css";
import { cn } from "@/lib/utils";
import { TooltipProvider } from "@/components/ui/tooltip";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "쿠팡 오너클랜 운영 모니터링",
  description: "위탁판매 운영자가 오늘 처리할 주문, 상품, CS, 반품 업무를 확인하는 모니터링 도구",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={cn("h-full", "antialiased", inter.variable, "font-sans", geist.variable)}
    >
      <body className="flex min-h-full flex-col">
        <AuthProvider>
          <TooltipProvider>{children}</TooltipProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
