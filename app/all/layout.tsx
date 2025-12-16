import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "All Fast Video Channels",
  description: "Browse and search all available Fast Video channels",
};

export default function AllChannelsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
