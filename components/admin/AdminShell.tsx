"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button, Divider, Menu, Typography } from "antd";
import {
  HomeOutlined,
  SettingOutlined,
  TableOutlined,
  TrophyOutlined,
} from "@ant-design/icons";
import { UserButton } from "@clerk/nextjs";

type MenuItem = {
  key: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
};

const primaryItems: MenuItem[] = [
  {
    key: "/admin",
    label: <Link href="/admin">Dashboard</Link>,
    icon: <HomeOutlined />,
  },
  {
    key: "/admin/teams",
    label: <Link href="/admin/teams">Teams</Link>,
    icon: <TableOutlined />,
  },
  {
    key: "/admin/brackets",
    label: <Link href="/admin/brackets">Brackets</Link>,
    icon: <TrophyOutlined />,
  },
  {
    key: "/admin/scoring",
    label: <Link href="/admin/scoring">Scoring</Link>,
    icon: <TrophyOutlined />,
  },
  {
    key: "/admin/overrides",
    label: <Link href="/admin/overrides">Overrides</Link>,
    icon: <SettingOutlined />,
  },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex min-h-screen">
        <aside className="hidden w-64 flex-col border-r border-gray-100 bg-white px-4 py-6 md:flex">
          <Typography.Text strong>Pickleball for Patriots</Typography.Text>
          <Typography.Text type="secondary">Admin</Typography.Text>
          <Divider className="my-4" />
          <Menu
            mode="inline"
            selectedKeys={pathname ? [pathname] : []}
            items={primaryItems}
          />
          <div className="mt-auto pt-6">
            <Link href="/">
              <Button block>Home</Button>
            </Link>
          </div>
        </aside>

        <div className="flex-1">
          <header className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white/90 px-6 py-4 backdrop-blur">
            <Typography.Text strong>Admin Dashboard</Typography.Text>
            <div className="flex items-center gap-3">
              <Link href="/">
                <Button>Home</Button>
              </Link>
              <UserButton />
            </div>
          </header>
          <main className="px-6 py-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
