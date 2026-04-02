"use client";

import { Space, Tabs, Typography } from "antd";
import { TeamOutlined } from "@ant-design/icons";
import { TeamsTable } from "@/components/admin/TeamsTable";

type TeamRow = {
  id: string;
  name: string;
  contact_email: string;
  is_active: boolean;
  bracket_type: string;
  players: {
    name: string;
    email: string;
  }[];
};

type Props = {
  recreationalTeams: TeamRow[];
  competitiveTeams: TeamRow[];
};

export function AdminTeamsClient({
  recreationalTeams,
  competitiveTeams,
}: Props) {
  return (
    <div className="max-w-7xl mx-auto">
      <Space align="center">
        <TeamOutlined className="text-gray-500" />
        <Typography.Title level={2} style={{ marginBottom: 0 }}>
          Team Management
        </Typography.Title>
      </Space>

      <Tabs
        items={[
          {
            key: "rec",
            label: "Recreational",
            children: <TeamsTable teams={recreationalTeams} />,
          },
          {
            key: "comp",
            label: "Competitive",
            children: <TeamsTable teams={competitiveTeams} />,
          },
        ]}
      />
    </div>
  );
}
