import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Trash Monitor",
  description: "Dashboard monitoring kapasitas tempat sampah berbasis IoT"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
