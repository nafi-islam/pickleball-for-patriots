"use client";

import { Button, Space, Table, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import { withdrawTeam } from "./actions";

type PlayerRow = {
  name: string;
  email: string;
};

type TeamRow = {
  id: string;
  name: string;
  contact_email: string;
  is_active: boolean;
  players: PlayerRow[];
};

const columns: ColumnsType<TeamRow> = [
  {
    title: "Team",
    dataIndex: "name",
  },
  {
    title: "Contact Email",
    dataIndex: "contact_email",
  },
  {
    title: "Players",
    render: (_, record) => (
      <Space direction="vertical" size={0}>
        {record.players.map((player) => (
          <span key={player.email}>
            {player.name} ({player.email})
          </span>
        ))}
      </Space>
    ),
  },
  {
    title: "Status",
    render: (_, record) =>
      record.is_active ? (
        <Tag color="green">Active</Tag>
      ) : (
        <Tag color="red">Withdrawn</Tag>
      ),
  },
  {
    title: "Actions",
    render: (_, record) =>
      record.is_active && (
        <Button danger size="small" onClick={() => withdrawTeam(record.id)}>
          Withdraw
        </Button>
      ),
  },
];

export function TeamsTable({ teams }: { teams: TeamRow[] }) {
  return (
    <Table
      rowKey="id"
      dataSource={teams}
      pagination={false}
      columns={columns}
    />
  );
}
