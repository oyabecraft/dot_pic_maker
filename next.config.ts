import type { NextConfig } from "next";

// GitHub Pages（https://oyabecraft.github.io/dot_pic_maker/）で配信するため静的書き出しにする。
const basePath = process.env.GITHUB_PAGES ? "/dot_pic_maker" : "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  images: { unoptimized: true },
};

export default nextConfig;
