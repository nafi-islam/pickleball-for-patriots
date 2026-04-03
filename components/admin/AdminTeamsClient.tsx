"use client";

import { Tabs } from "antd";
import { TeamOutlined } from "@ant-design/icons";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
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
    <div className="max-w-6xl mx-auto px-6 py-8">
      <AdminPageHeader
        title="Team Management"
        subtitle="Review registrations and withdraw teams when needed."
        icon={<TeamOutlined />}
      />

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
