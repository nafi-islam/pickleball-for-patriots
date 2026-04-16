"use client";

import { useMemo, useState } from "react";
import { Card, Input, Space, Table, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { DollarOutlined } from "@ant-design/icons";

type TicketPayment = {
  email: string;
  name: string | null;
  amountPaid: number;
  currency: string;
  paidAt: number;
  sessionId: string;
};

const columns: ColumnsType<TicketPayment> = [
  {
    title: "Name",
    dataIndex: "name",
    render: (name: string | null) => name ?? "—",
    sorter: (a, b) => (a.name ?? "").localeCompare(b.name ?? ""),
  },
  {
    title: "Email",
    dataIndex: "email",
  },
  {
    title: "Amount",
    dataIndex: "amountPaid",
    render: (amount: number, record) =>
      `${(amount / 100).toFixed(2)} ${record.currency.toUpperCase()}`,
    sorter: (a, b) => a.amountPaid - b.amountPaid,
    width: 120,
  },
  {
    title: "Date",
    dataIndex: "paidAt",
    render: (ts: number) =>
      new Date(ts * 1000).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
    sorter: (a, b) => a.paidAt - b.paidAt,
    defaultSortOrder: "descend",
    width: 140,
  },
];

export function PaidTicketsTable({
  payments,
}: {
  payments: TicketPayment[];
}) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return payments;
    const q = search.toLowerCase();
    return payments.filter(
      (p) =>
        p.email.includes(q) ||
        (p.name && p.name.toLowerCase().includes(q)),
    );
  }, [payments, search]);

  return (
    <Card style={{ borderRadius: 16 }} styles={{ body: { padding: 20 } }}>
      <Space direction="vertical" size={12} className="w-full">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <Space size={8}>
            <DollarOutlined />
            <Typography.Title level={4} style={{ marginBottom: 0 }}>
              Paid Tickets
            </Typography.Title>
            <Tag color="green">{payments.length}</Tag>
          </Space>
          <Input.Search
            placeholder="Search by name or email"
            allowClear
            onChange={(e) => setSearch(e.target.value)}
            style={{ maxWidth: 300 }}
          />
        </div>
        <Table
          rowKey="sessionId"
          dataSource={filtered}
          columns={columns}
          size="small"
          pagination={{ pageSize: 10, hideOnSinglePage: true }}
          scroll={{ x: true }}
        />
      </Space>
    </Card>
  );
}
