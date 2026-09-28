import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";
import "./nexus-ai.css";
import "./auth.css";
import "./stage3.css";

const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });
const mono = Geist_Mono({ variable: "--font-mono", subsets: ["latin"] });

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const description = "A focused operations dashboard for your n8n workflows and executions.";
  return {
    metadataBase: new URL(`${protocol}://${host}`),
    title: { default: "N8N Nexus", template: "%s · N8N Nexus" },
    description,
    icons: { icon: "/favicon.svg" },
    openGraph: { title: "N8N Nexus — Your automations. Under control.", description, images: [{ url: "/og.png", width: 1730, height: 909 }] },
    twitter: { card: "summary_large_image", title: "N8N Nexus — Your automations. Under control.", description, images: ["/og.png"] },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" data-scroll-behavior="smooth"><body className={`${geist.variable} ${mono.variable}`}>{children}</body></html>;
}
