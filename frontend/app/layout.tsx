import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { QueryProvider } from "@/lib/query-provider";

export const metadata: Metadata = {
  title: "ContractIQ — AI Contract Intelligence",
  description:
    "Multi-agent AI platform for batch contract review, risk scoring, and redline generation powered by Google ADK and Gemini.",
  keywords: ["contract review", "AI legal", "risk scoring", "Google ADK", "Gemini"],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="min-h-screen bg-[rgb(10,10,15)] text-slate-100 antialiased">
        <AuthProvider>
          <QueryProvider>{children}</QueryProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
