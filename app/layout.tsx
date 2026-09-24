import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";
import { buildDesignCss } from "@/lib/design-css";
import { ThemeInit, AppWidthInit } from "@/components/shell/shell-init";

export const metadata: Metadata = {
  title: "Fractera — Sign in",
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const { css: designCss, fontLinks: designFontLinks } = buildDesignCss();
  return (
    // suppressHydrationWarning: класс `dark` на <html> ставит скрипт темы до гидратации (285-2).
    <html lang="en" suppressHydrationWarning>
      {/* 280-10: оформление из DESIGN-CONFIG службы — то же, что у сайта узла, если ядро его прислало. */}
      <head>
        {/* 285-2/285-3: тема и ширина — выбор посетителя на весь проект (cookie проекта), до первого кадра,
            на ВСЕХ страницах входа, включая /login и /register. */}
        <ThemeInit />
        <AppWidthInit />
        {designCss && <style dangerouslySetInnerHTML={{ __html: designCss }} />}
        {designFontLinks.map((href) => (
          <link key={href} rel="stylesheet" href={href} />
        ))}
      </head>
      <body>
        {children}
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
