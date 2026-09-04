import "./globals.css"
import { PwaRegister } from "@/components/pwa-register"
import { AppCommandMenu } from "@/components/app-command-menu"
import { AuthSessionGuard } from "@/components/auth-session-guard"
import { MobileAppGuard } from "@/components/mobile-app-guard"
import { RouteScrollReset } from "@/components/route-scroll-reset"
import { ThemeProvider } from "@/components/theme-provider"
import { TooltipProvider } from "@/components/ui/tooltip"
import { appTitle } from "@/lib/page-title"
import type { Metadata } from "next"
import type { Viewport } from "next"
import localFont from "next/font/local"
import * as React from "react"

const inter = localFont({
  src: "../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2",
  display: "swap",
  weight: "100 900",
  variable: "--font-inter",
})

export const metadata: Metadata = {
  title: appTitle,
  description:
    "Africa CTN admin tools for month end, quotes, notes, and pricing.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
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
  maximumScale: 1,
  userScalable: false,
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
      className={`font-sans antialiased ${inter.variable}`}
    >
      <body>
        <ThemeProvider>
          <TooltipProvider>
            <PwaRegister />
            <MobileAppGuard />
            <AuthSessionGuard />
            <React.Suspense fallback={null}>
              <RouteScrollReset />
            </React.Suspense>
            <AppCommandMenu />
            {children}
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
