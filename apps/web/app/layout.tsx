import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sasori · orquestrador de agentes",
  description: "Marionetes de IA puxadas por fios de chakra",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="h-screen overflow-hidden">{children}</body>
    </html>
  );
}
