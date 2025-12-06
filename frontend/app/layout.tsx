import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Stars from "./components/Stars";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Data Pipeline Reimagined",
  description: "Configuration Dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Stars />
        <div className="relative z-10 flex flex-col min-h-screen">
          {children}
        </div>
      </body>
    </html>
  );
}
