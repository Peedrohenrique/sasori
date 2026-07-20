import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sasori · orquestrador de agentes",
  description: "Marionetes de IA puxadas por fios de chakra",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: o script de tema muda a classe do <html> antes da hidratação
    <html lang="pt-BR" suppressHydrationWarning>
      <body className="h-screen overflow-hidden">
        {/* aplica o tema salvo ANTES do paint — evita flash de tema errado */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem("sasori-theme")==="light")document.documentElement.classList.add("light")}catch(e){}`,
          }}
        />
        {children}
      </body>
    </html>
  );
}
