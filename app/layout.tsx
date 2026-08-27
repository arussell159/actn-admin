import "./globals.css"
import { PwaRegister } from "@/components/pwa-register"
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
    ],
    shortcut: ["/favicon.ico"],
    apple: [
      {
        url: "/apple-icon.png",
        type: "image/png",
        sizes: "144x144",
      },
    ],
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  colorScheme: "light",
  themeColor: "#ffffff",
  viewportFit: "cover",
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
            {children}
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
