import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Syne, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const syne = Syne({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "StreamMind AI — The AI Co-Pilot for KICK Streamers",
  description: "StreamMind AI is the first real-time AI co-pilot built exclusively for KICK streamers. Filter toxic chat, surface unanswered questions, detect clip-worthy moments, and get AI producer recommendations — all in real-time.",
  keywords: ["KICK", "streaming", "AI", "co-pilot", "moderation", "clip detection", "StreamMind"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${plusJakartaSans.variable} ${syne.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans bg-[#030305] text-[#F4F4F6]">{children}</body>
    </html>
  );
}
