"use client";

import { Card, Space, Tag, Typography } from "antd";

export function EventDaySection() {
  return (
    <section className="py-10 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto">
        <Card style={{ borderRadius: 16 }}>
          <Space direction="vertical" size={12} className="w-full">
            <Tag color="blue">The day</Tag>
            <Typography.Title level={2} style={{ margin: 0 }}>
              Your day at the event
            </Typography.Title>
            <Typography.Paragraph style={{ fontSize: 16, marginBottom: 12 }}>
              With each ticket purchase you&apos;re guaranteed{" "}
              <strong>three pickleball matches</strong> in a{" "}
              <strong>round-robin</strong>, the chance to{" "}
              <strong>advance into single elimination</strong>, a{" "}
              <strong>guest speaker from Camp Hope</strong>, and{" "}
              <strong>Canes</strong> catered <strong>lunch</strong> with{" "}
              <strong>water</strong>.
            </Typography.Paragraph>
            <Typography.Paragraph style={{ marginBottom: 12 }}>
              <Typography.Text type="secondary" strong>
                Schedule
              </Typography.Text>
            </Typography.Paragraph>
            <Typography.Paragraph style={{ fontSize: 16, marginBottom: 8 }}>
              <strong>9:00 AM – 12:00 PM (noon)</strong> — Recreational
              tournament.
            </Typography.Paragraph>
            <Typography.Paragraph style={{ fontSize: 16, marginBottom: 8 }}>
              <strong>12:00 PM – 1:00 PM</strong> — Canes lunch &amp; water
              (catered). Around this time, a{" "}
              <strong>veteran from Camp Hope</strong> will share their story.
            </Typography.Paragraph>
            <Typography.Paragraph style={{ fontSize: 16, marginBottom: 0 }}>
              <strong>1:00 PM – 4:00 PM</strong> — Competitive tournament.
            </Typography.Paragraph>
          </Space>
        </Card>
      </div>
    </section>
  );
}
