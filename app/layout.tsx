import { type Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { Analytics } from "@vercel/analytics/react";
import "antd/dist/reset.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pickleball for Patriots",
  description: "Aggie Club of Engineers Charity Pickleball Tournament",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        <AntdRegistry>
          <ClerkProvider>
            {children}
            <Analytics />
          </ClerkProvider>
        </AntdRegistry>
      </body>
    </html>
  );
}
