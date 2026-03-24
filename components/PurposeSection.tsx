"use client";

import { Card, Space, Tag, Typography } from "antd";

export default function PurposeSection() {
  return (
    <section className="py-10 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto">
        <Card style={{ borderRadius: 16 }}>
          <Space direction="vertical" size={12} className="w-full">
            <Tag color="blue">About</Tag>
            <Typography.Title level={2} style={{ margin: 0 }}>
              Our Purpose
            </Typography.Title>
            <Typography.Paragraph style={{ fontSize: 16, marginBottom: 12 }}>
              Pickleball for Patriots raises funds for Camp Hope, an outreach of
              the PTSD Foundation of America that supports veterans and their
              families.
            </Typography.Paragraph>
            <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
              Every registration and sponsorship helps provide peer support,
              counseling pathways, and community for heroes transitioning toward
              healing.
            </Typography.Paragraph>
          </Space>
        </Card>
      </div>
    </section>
  );
}
