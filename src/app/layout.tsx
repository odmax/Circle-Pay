import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { ThemeProvider } from "next-themes"
import { Toaster } from "sonner"
import { SessionProvider } from "@/components/layout/session-provider"
import "./globals.css"

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: {
    default: "Circle Pay — Group Finance, Simplified",
    template: "%s | Circle Pay",
  },
  description:
    "Save, track expenses, and manage money together with your circles. The group finance platform by Mozetech.",
  keywords: [
    "group finance",
    "bill splitting",
    "savings circle",
    "expense tracking",
    "Africa fintech",
    "Mozetech",
  ],
  authors: [{ name: "Mozetech", url: "https://mozetech.com" }],
  creator: "Mozetech",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  ),
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "Circle Pay",
    title: "Circle Pay — Group Finance, Simplified",
    description: "Save, track expenses, and manage money together with your circles.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Circle Pay — Group Finance, Simplified",
    description: "Save, track expenses, and manage money together with your circles.",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Circle Pay",
  },
  applicationName: "Circle Pay",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-background font-sans antialiased">
        <SessionProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="light"
            enableSystem
            disableTransitionOnChange
          >
            {children}
            <Toaster
              position="top-right"
              toastOptions={{
                classNames: {
                  toast:
                    "group border-border bg-card text-card-foreground",
                  title: "text-sm font-semibold",
                  description: "text-xs text-muted-foreground",
                },
              }}
            />
          </ThemeProvider>
        </SessionProvider>
      </body>
    </html>
  )
}
