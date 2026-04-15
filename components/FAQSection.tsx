"use client";

import { Card, Collapse, Space, Tag, Typography } from "antd";

const items = [
  {
    key: "1",
    label: "Who can participate?",
    children: (
      <p>
        We welcome anyone and players of all skill levels! We offer recreational
        and competitive brackets so players of all skill levels are welcome.
      </p>
    ),
  },
  {
    key: "2",
    label: "How are brackets structured?",
    children: (
      <p>
        First, teams are placed into qualifying courts and play a round robin
        against the other teams in their court. The top teams from each court
        advance to the main bracket. After that, the tournament becomes a
        single-elimination bracket, so each match determines who moves on and
        who is out. Final court assignments and timing are shared after
        registration closes.
      </p>
    ),
  },
  {
    key: "3",
    label: "What should I bring?",
    children: (
      <p>
        We recommend you bring athletic shoes, water, and your own paddle
        (BYOP). We also suggest you bring your competitive spirit!
      </p>
    ),
  },
];

export default function FAQSection() {
  return (
    <section className="py-10 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto">
        <Card style={{ borderRadius: 16 }}>
          <Space direction="vertical" size={12} className="w-full">
            <Tag color="gold">FAQ</Tag>
            <Typography.Title level={2} style={{ margin: 0 }}>
              Frequently Asked Questions
            </Typography.Title>
            <Collapse items={items} />
          </Space>
        </Card>
      </div>
    </section>
  );
}
