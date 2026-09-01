import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://steal-tally-rescue-zhao.sunjidian365.chatgpt.site"),
  title: "窃符救赵 · 魏宫夜行",
  description: "操控信陵君门下木偶，潜入魏宫，避开内侍，盗取虎符并完成救赵使命。",
  openGraph: {
    title: "窃符救赵 · 魏宫夜行",
    description: "一款皮影木偶风格的 3D 网页潜行冒险游戏。",
    type: "website",
    images: [{ url: "/og.png", width: 1536, height: 1024, alt: "窃符救赵游戏场景" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "窃符救赵 · 魏宫夜行",
    description: "潜入魏宫，避开内侍，盗取虎符。",
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
