"use client";

import { useMemo } from "react";
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
  paidEmails: string[];
};

export function AdminTeamsClient({
  recreationalTeams,
  competitiveTeams,
  paidEmails: paidEmailsList,
}: Props) {
  const paidEmails = useMemo(
    () => new Set(paidEmailsList),
    [paidEmailsList],
  );

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
            children: (
              <TeamsTable teams={recreationalTeams} paidEmails={paidEmails} />
            ),
          },
          {
            key: "comp",
            label: "Competitive",
            children: (
              <TeamsTable teams={competitiveTeams} paidEmails={paidEmails} />
            ),
          },
        ]}
      />
    </div>
  );
}
