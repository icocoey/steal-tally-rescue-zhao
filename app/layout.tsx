import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "窃符救赵 · 魏宫夜行",
  description: "操控信陵君门下木偶，潜入魏宫，避开内侍，盗取虎符并完成救赵使命。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
