import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";
import { buildDesignCss } from "@/lib/design-css";

export const metadata: Metadata = {
  title: "Fractera — Sign in",
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const { css: designCss, fontLinks: designFontLinks } = buildDesignCss();
  return (
    <html lang="en">
      {/* 280-10: оформление из DESIGN-CONFIG службы — то же, что у сайта узла, если ядро его прислало. */}
      <head>
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
