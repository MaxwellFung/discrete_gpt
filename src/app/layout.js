import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Discrete GPT – Discrete ChatGPT & Discrete AI",
  description: "DiscreteGPT is a minimal chat AI styled like Google Docs.",
  keywords: [
    "discrete gpt",
    "discretegpt",
    "discrete chat gpt",
    "discrete ai"
  ],
  openGraph: {
    title: "Discrete GPT – Discrete LLM Interface",
    description: "DiscreteGPT is a discrete chat AI styled like Google Docs.",
    url: "https://discretegpt.com",
    siteName: "Discrete GPT",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Discrete GPT",
    description: "Discrete chat AI that looks like Google Docs.",
    images: ["/logo.png"],
  },
};



export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        {children}
        <Analytics />
      </body>
    </html>
  );
}

