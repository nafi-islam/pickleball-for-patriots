"use client";

import { Space, Tooltip, Typography } from "antd";
import type { ReactNode } from "react";
import { InfoCircleOutlined } from "@ant-design/icons";

type Props = {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  tooltip?: string;
};

export function AdminPageHeader({ title, subtitle, icon, tooltip }: Props) {
  return (
    <div className="mb-4">
      <Space align="center">
        {icon ? <span className="text-gray-500">{icon}</span> : null}
        <Typography.Title level={2} style={{ marginBottom: 0 }}>
          {title}
        </Typography.Title>
        {tooltip ? (
          <Tooltip placement="right" title={tooltip}>
            <InfoCircleOutlined className="text-gray-500" />
          </Tooltip>
        ) : null}
      </Space>
      {subtitle ? (
        <Typography.Paragraph type="secondary" style={{ margin: "4px 0 0" }}>
          {subtitle}
        </Typography.Paragraph>
      ) : null}
    </div>
  );
}
