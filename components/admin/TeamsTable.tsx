"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Descriptions, Space, Table, Tag, message } from "antd";
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

export function TeamsTable({ teams }: { teams: TeamRow[] }) {
  const router = useRouter();
  const [messageApi, contextHolder] = message.useMessage();
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const columns: ColumnsType<TeamRow> = [
    {
      title: "Team",
      dataIndex: "name",
    },
    {
      title: "Contact Email",
      dataIndex: "contact_email",
      responsive: ["md"],
    },
    {
      title: "Players",
      responsive: ["md"],
      render: (_, record) => (
        <Space orientation="vertical" size={0}>
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
          <Button
            danger
            size="small"
            loading={loadingId === record.id}
            onClick={async () => {
              try {
                setLoadingId(record.id);
                await withdrawTeam(record.id);
                messageApi.success("Team withdrawn.");
                router.refresh();
              } catch (error) {
                messageApi.error(
                  error instanceof Error
                    ? error.message
                    : "Failed to withdraw team.",
                );
              } finally {
                setLoadingId(null);
              }
            }}
          >
            Withdraw
          </Button>
        ),
    },
  ];

  return (
    <>
      {contextHolder}
      <Table
        rowKey="id"
        dataSource={teams}
        pagination={false}
        columns={columns}
        size="small"
        scroll={{ x: true }}
        expandable={{
          expandedRowRender: (record) => (
            <Descriptions
              size="small"
              column={1}
              items={[
                {
                  key: "contact",
                  label: "Contact Email",
                  children: record.contact_email,
                },
                {
                  key: "players",
                  label: "Players",
                  children: (
                    <Space orientation="vertical" size={0}>
                      {record.players.map((player) => (
                        <span key={player.email}>
                          {player.name} ({player.email})
                        </span>
                      ))}
                    </Space>
                  ),
                },
              ]}
            />
          ),
          rowExpandable: () => true,
        }}
      />
    </>
  );
}
