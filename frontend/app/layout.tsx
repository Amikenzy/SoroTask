import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";
import { CommandPalette } from "@/components/CommandPalette";
import { AuthProvider } from "@/context/AuthContext";
import { PwaRegistration } from "@/components/pwa/PwaRegistration";

export const metadata: Metadata = {
  title: "SoroTask Frontend Performance Monitoring",
  description:
    "Track route load, task open, search, and mutation responsiveness in the SoroTask frontend.",
  manifest: "/manifest.json",
  themeColor: "#09090b",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "SoroTask",
  },
};

// Runs before first paint to avoid theme flash
const themeScript = `
(function(){
  try {
    var m = localStorage.getItem('theme') || 'system';
    var resolved = m === 'system'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : m;
    document.documentElement.setAttribute('data-theme', resolved);
  } catch(e){}
})();
`;

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const nonce = (await headers()).get("x-nonce");
  if (!nonce) {
    throw new Error("Missing CSP nonce. Ensure the security middleware runs for this page.");
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <CommandPalette />
        <PwaRegistration />
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
