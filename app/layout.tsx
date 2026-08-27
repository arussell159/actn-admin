import "./globals.css"
import { PwaRegister } from "@/components/pwa-register"
import { ThemeProvider } from "@/components/theme-provider"
import { TooltipProvider } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import type { Metadata } from "next"
import type { Viewport } from "next"
import { Inter } from "next/font/google";

const inter = Inter({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: "Africa CTN Month End",
  description: "Africa CTN month-end checklist",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Month End",
  },
  applicationName: "Africa CTN Month End",
  manifest: "/manifest.webmanifest",
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
