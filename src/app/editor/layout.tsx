import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "TraceRecap Editor — Create Your Route Animation",
  description:
    "Build, preview, and export your travel route animation in the TraceRecap editor.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
};

export default function EditorLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
