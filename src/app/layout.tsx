import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vasthrapetty | Elegance in every detail",
  description: "Thoughtfully curated hampers for meaningful moments.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
