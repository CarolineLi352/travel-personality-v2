import type { Metadata } from "next";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const siteOrigin = process.env.NEXT_PUBLIC_SITE_ORIGIN ?? "http://localhost:3000";

export function createSiteMetadata(language: "zh" | "en"): Metadata {
  const en = language === "en";
  const title = en
    ? "Travel Personality Indicator | Discover Your Travel Type"
    : "Travel Personality Indicator｜AI算法看穿你的旅行人格";
  const description = en
    ? "Take 12 playful questions to discover your travel personality, fantasy destination and real-world trip matches."
    : "12 道不正经选择题，用本地趣味规则测出你的旅行人格、异世界目的地和现实出发方案";
  const pagePath = en ? `${basePath}/en/` : `${basePath}/`;
  const imagePath = en ? `${basePath}/social-preview-en.png` : `${basePath}/social-preview.png`;

  return {
    metadataBase: new URL(siteOrigin),
    title,
    description,
    alternates: {
      canonical: pagePath,
      languages: {
        "zh-CN": `${basePath}/`,
        "en-GB": `${basePath}/en/`,
        "x-default": `${basePath}/`,
      },
    },
    openGraph: {
      title,
      description,
      type: "website",
      locale: en ? "en_GB" : "zh_CN",
      alternateLocale: [en ? "zh_CN" : "en_GB"],
      url: pagePath,
      images: [{
        url: imagePath,
        width: 1200,
        height: 630,
        alt: en ? "Travel Personality Indicator quiz preview" : "Travel Personality Indicator 几何动物人格测试",
      }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imagePath],
    },
  };
}
