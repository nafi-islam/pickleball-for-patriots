"use client";

import Image from "next/image";
import { SignInButton, SignedOut, SignedIn, UserButton } from "@clerk/nextjs";
import { Button, Typography } from "antd";

export default function LandingHeader() {
  return (
    <header className="flex items-center justify-between px-6 md:px-10 py-6 max-w-7xl mx-auto w-full">
      <div className="flex items-center gap-3">
        <Image src="/assets/ACE.png" alt="ACE Logo" width={44} height={44} />
        <div>
          <Typography.Text strong>Aggie Club of Engineers</Typography.Text>
          <Typography.Paragraph
            type="secondary"
            style={{ margin: 0, fontSize: 12 }}
          >
            Philanthropy 2026
          </Typography.Paragraph>
        </div>
      </div>

      <div>
        <SignedOut>
          <SignInButton>
            <Button type="text">Member Sign In</Button>
          </SignInButton>
        </SignedOut>
        <SignedIn>
          <UserButton />
        </SignedIn>
      </div>
    </header>
  );
}
