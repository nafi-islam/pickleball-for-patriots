"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button, Card, Empty, Space, Tabs, Tag, Typography, message } from "antd";
import { SettingOutlined } from "@ant-design/icons";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { undoMatchResult } from "@/app/admin/overrides/actions";

type MatchRow = {
  id: string;
  round: number;
  index_in_round: number;
  score_a: number | null;
  score_b: number | null;
  team_a?: { id: string; name: string } | null;
  team_b?: { id: string; name: string } | null;
  winner?: { id: string; name: string } | null;
};

function CompletedMatchesList({ matches }: { matches: MatchRow[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [messageApi, contextHolder] = message.useMessage();

  if (matches.length === 0) {
    return (
      <Card style={{ borderRadius: 12 }}>
        <Empty description="No completed matches yet." />
      </Card>
    );
  }

  return (
    <Space direction="vertical" size={16} className="w-full">
      {contextHolder}
      {matches.map((match) => (
        <Card key={match.id} style={{ borderRadius: 12 }}>
          <Space direction="vertical" size={10} className="w-full">
            <div className="flex items-center justify-between">
              <Typography.Text strong>
                Round {match.round} · Match {match.index_in_round}
              </Typography.Text>
              <div className="flex items-center gap-2">
                {((match.team_a && !match.team_b) ||
                  (!match.team_a && match.team_b)) && (
                  <Tag color="gold">Bye</Tag>
                )}
                <Tag color="green">Completed</Tag>
              </div>
            </div>

            <Typography.Text>
              {match.team_a?.name ?? "TBD"} {match.score_a ?? "—"}
            </Typography.Text>

            <Typography.Text>
              {match.team_b?.name ?? "TBD"} {match.score_b ?? "—"}
            </Typography.Text>

            <Typography.Text type="secondary">
              Winner: {match.winner?.name ?? "Unknown"}
            </Typography.Text>

            {((match.team_a && !match.team_b) ||
              (!match.team_a && match.team_b)) ? (
              <Typography.Text type="secondary">
                Bye matches cannot be undone. Use reset bracket or manual
                seeding.
              </Typography.Text>
            ) : (
              <Button
                danger
                loading={isPending}
                onClick={() =>
                  startTransition(async () => {
                    const result = await undoMatchResult(match.id);
                    if ("error" in result) {
                      messageApi.error(result.error);
                    } else {
                      messageApi.success("Match result undone.");
                      router.refresh();
                    }
                  })
                }
              >
                Undo Result
              </Button>
            )}
          </Space>
        </Card>
      ))}
    </Space>
  );
}

export function AdminOverridesClient({
  recreationalMatches,
  competitiveMatches,
}: {
  recreationalMatches: MatchRow[];
  competitiveMatches: MatchRow[];
}) {
  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <AdminPageHeader
        title="Admin Overrides"
        subtitle="Safely undo completed match results and clear downstream bracket state."
        icon={<SettingOutlined />}
      />

      <Tabs
        items={[
          {
            key: "rec",
            label: "Recreational",
            children: <CompletedMatchesList matches={recreationalMatches} />,
          },
          {
            key: "comp",
            label: "Competitive",
            children: <CompletedMatchesList matches={competitiveMatches} />,
          },
        ]}
      />
    </div>
  );
}
