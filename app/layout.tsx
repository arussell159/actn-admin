import "./globals.css"
import { PwaRegister } from "@/components/pwa-register"
import { AuthSessionGuard } from "@/components/auth-session-guard"
import { ThemeProvider } from "@/components/theme-provider"
import { TooltipProvider } from "@/components/ui/tooltip"
import { appTitle } from "@/lib/page-title"
import { cn } from "@/lib/utils"
import type { Metadata } from "next"
import type { Viewport } from "next"
import { Inter } from "next/font/google";

const inter = Inter({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: appTitle,
  description: "Africa CTN admin tools for month end, quotes, notes, and pricing.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: appTitle,
  },
  applicationName: appTitle,
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      {
        url: "/actn-admin-icon.png",
        type: "image/png",
        sizes: "144x144",
      },
      {
        url: "/actn-admin-icon-192.png",
        type: "image/png",
        sizes: "192x192",
      },
      {
        url: "/actn-admin-icon-512.png",
        type: "image/png",
        sizes: "512x512",
      },
    ],
    shortcut: ["/favicon.ico"],
    apple: [
      {
        url: "/apple-icon.png",
        type: "image/png",
        sizes: "180x180",
      },
    ],
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "light",
  themeColor: "#ffffff",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("antialiased", "font-sans", inter.variable)}
    >
      <body>
        <ThemeProvider>
          <TooltipProvider>
            <PwaRegister />
            <AuthSessionGuard />
            {children}
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
