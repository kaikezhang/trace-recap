"use client";

import dynamic from "next/dynamic";

const EditorLayout = dynamic(() => import("@/components/editor/EditorLayout"), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen w-screen items-center justify-center">
      Loading editor...
    </div>
  ),
});

export default function EditorPage() {
  return <EditorLayout />;
}
