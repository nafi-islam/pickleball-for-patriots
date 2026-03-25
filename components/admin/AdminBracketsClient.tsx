"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button, Card, Col, Empty, Row, Space, Tag, Typography, message } from "antd";
import { generateBracket } from "@/app/admin/brackets/actions";

type BracketSummary = {
  id: string;
  type: "recreational" | "competitive";
  status: string;
  activeTeamCount: number;
  matchCount: number;
};

export function AdminBracketsClient({
  brackets,
}: {
  brackets: BracketSummary[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [messageApi, contextHolder] = message.useMessage();

  const handleGenerate = (type: BracketSummary["type"]) => {
    startTransition(async () => {
      try {
        await generateBracket(type);
        messageApi.success("Bracket generated.");
        router.refresh();
      } catch (error) {
        messageApi.error(
          error instanceof Error
            ? error.message
            : "Failed to generate bracket.",
        );
      }
    });
  };

  return (
    <div className="max-w-6xl mx-auto">
      {contextHolder}
      <Typography.Title level={2}>Bracket Generation</Typography.Title>
      <Typography.Paragraph type="secondary">
        Generate the tournament bracket once registration is finalized. This
        creates all matches for the selected bracket and handles byes
        automatically.
      </Typography.Paragraph>

      {brackets.length === 0 ? (
        <Card style={{ borderRadius: 16 }}>
          <Empty description="No brackets found. Seed the recreational and competitive brackets first." />
        </Card>
      ) : (
        <Row gutter={[16, 16]}>
          {brackets.map((bracket) => {
            const isDisabled =
              bracket.activeTeamCount < 2 || bracket.matchCount > 0 || isPending;

            return (
              <Col xs={24} md={12} key={bracket.id}>
                <Card style={{ borderRadius: 16 }}>
                  <Space direction="vertical" size={12} className="w-full">
                    <div className="flex items-center justify-between">
                      <Typography.Title level={4} style={{ margin: 0 }}>
                        {bracket.type === "recreational"
                          ? "Recreational"
                          : "Competitive"}
                      </Typography.Title>
                      <Tag
                        color={bracket.status === "GENERATED" ? "green" : "blue"}
                      >
                        {bracket.status}
                      </Tag>
                    </div>

                    <Typography.Text>
                      Active teams: {bracket.activeTeamCount}
                    </Typography.Text>

                    <Typography.Text>
                      Existing matches: {bracket.matchCount}
                    </Typography.Text>

                    <Button
                      type="primary"
                      disabled={isDisabled}
                      loading={isPending}
                      onClick={() => handleGenerate(bracket.type)}
                    >
                      Generate Bracket
                    </Button>
                  </Space>
                </Card>
              </Col>
            );
          })}
        </Row>
      )}
    </div>
  );
}
