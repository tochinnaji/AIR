import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "Forme — Resume builder", description: "A thoughtful, fact-first workspace for your next opportunity." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
