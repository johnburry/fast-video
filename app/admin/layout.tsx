import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "PlaySermons.com Admin",
  description: "Admin panel for PlaySermons.com - Import YouTube channels and transcripts",
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
