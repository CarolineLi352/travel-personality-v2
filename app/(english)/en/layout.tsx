import "../../globals.css";
import { createSiteMetadata } from "@/lib/site-metadata";

export const metadata = createSiteMetadata("en");

export default function EnglishRootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-GB">
      <body>{children}</body>
    </html>
  );
}
