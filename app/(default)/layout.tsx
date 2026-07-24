import "../globals.css";
import { createSiteMetadata } from "@/lib/site-metadata";

export const metadata = createSiteMetadata("zh");

export default function ChineseRootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
