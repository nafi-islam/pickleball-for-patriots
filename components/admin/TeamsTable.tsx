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

type Props = {
  teams: TeamRow[];
  paidEmails?: Set<string>;
};

export function TeamsTable({ teams, paidEmails }: Props) {
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
          {record.players.map((player, idx) => (
            <span key={`${idx}-${player.email}`}>
              {player.name} ({player.email}){" "}
              {paidEmails && (
                paidEmails.has(player.email.toLowerCase()) ? (
                  <Tag color="green">Paid</Tag>
                ) : (
                  <Tag color="red">Unpaid</Tag>
                )
              )}
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
              setLoadingId(record.id);
              try {
                const result = await withdrawTeam(record.id);
                if ("error" in result) {
                  messageApi.error(result.error);
                } else {
                  messageApi.success("Team withdrawn.");
                  router.refresh();
                }
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
                      {record.players.map((player, idx) => (
                        <span key={`${idx}-${player.email}`}>
                          {player.name} ({player.email}){" "}
                          {paidEmails && (
                            paidEmails.has(player.email.toLowerCase()) ? (
                              <Tag color="green">Paid</Tag>
                            ) : (
                              <Tag color="red">Unpaid</Tag>
                            )
                          )}
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
