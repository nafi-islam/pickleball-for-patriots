"use client";

import { Button, Card, Empty, Space, Tabs, Tag, Typography } from "antd";
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
  if (matches.length === 0) {
    return (
      <Card style={{ borderRadius: 12 }}>
        <Empty description="No completed matches yet." />
      </Card>
    );
  }

  return (
    <Space direction="vertical" size={16} className="w-full">
      {matches.map((match) => (
        <Card key={match.id} style={{ borderRadius: 12 }}>
          <Space direction="vertical" size={10} className="w-full">
            <div className="flex items-center justify-between">
              <Typography.Text strong>
                Round {match.round} · Match {match.index_in_round}
              </Typography.Text>
              <Tag color="green">Completed</Tag>
            </div>

            <Typography.Text>
              {match.team_a?.name ?? "TBD"} {match.score_a ?? "-"}
            </Typography.Text>

            <Typography.Text>
              {match.team_b?.name ?? "TBD"} {match.score_b ?? "-"}
            </Typography.Text>

            <Typography.Text type="secondary">
              Winner: {match.winner?.name ?? "Unknown"}
            </Typography.Text>

            <form action={undoMatchResult.bind(null, match.id)}>
              <Button danger htmlType="submit">
                Undo Result
              </Button>
            </form>
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
      <Typography.Title level={2}>Admin Overrides</Typography.Title>
      <Typography.Paragraph type="secondary">
        Use this page to safely undo completed match results and clear downstream
        bracket state when a score was entered incorrectly.
      </Typography.Paragraph>

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
