import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Fast.Video Admin",
  description: "Admin panel for Fast.Video - Import YouTube channels and transcripts",
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
