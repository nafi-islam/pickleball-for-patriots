"use client";

import { Card, Space, Tabs, Tag, Typography } from "antd";
import ScoreForm from "@/components/admin/ScoreForm";

type MatchRow = {
  id: string;
  round: number;
  index_in_round: number;
  status: string;
  score_a: number | null;
  score_b: number | null;
  team_a?: { id: string; name: string } | null;
  team_b?: { id: string; name: string } | null;
  winner?: { id: string; name: string } | null;
};

function BracketScoringSection({ matches }: { matches: MatchRow[] }) {
  return (
    <Space direction="vertical" size={16} className="w-full">
      {matches.map((match) => {
        const ready =
          match.team_a && match.team_b && match.status !== "COMPLETED";

        return (
          <Card key={match.id} style={{ borderRadius: 12 }}>
            <Space direction="vertical" size={10} className="w-full">
              <div className="flex items-center justify-between">
                <Typography.Text strong>
                  Round {match.round} · Match {match.index_in_round}
                </Typography.Text>
                {match.status === "COMPLETED" ? (
                  <Tag color="green">Completed</Tag>
                ) : ready ? (
                  <Tag color="blue">Ready</Tag>
                ) : (
                  <Tag>Waiting</Tag>
                )}
              </div>

              <Typography.Text>{match.team_a?.name ?? "TBD"}</Typography.Text>
              <Typography.Text>{match.team_b?.name ?? "TBD"}</Typography.Text>

              {match.status === "COMPLETED" ? (
                <Typography.Text type="secondary">
                  Final: {match.score_a} - {match.score_b}
                </Typography.Text>
              ) : ready ? (
                <ScoreForm
                  matchId={match.id}
                  teamAName={match.team_a.name}
                  teamBName={match.team_b.name}
                />
              ) : (
                <Typography.Text type="secondary">
                  Match will become available when both teams are known.
                </Typography.Text>
              )}
            </Space>
          </Card>
        );
      })}
    </Space>
  );
}

export function AdminScoringClient({
  recreationalMatches,
  competitiveMatches,
}: {
  recreationalMatches: MatchRow[];
  competitiveMatches: MatchRow[];
}) {
  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <Typography.Title level={2}>Scoring & Advancement</Typography.Title>
      <Typography.Paragraph type="secondary">
        Record match results and automatically advance winners through the
        bracket.
      </Typography.Paragraph>

      <Tabs
        items={[
          {
            key: "rec",
            label: "Recreational",
            children: <BracketScoringSection matches={recreationalMatches} />,
          },
          {
            key: "comp",
            label: "Competitive",
            children: <BracketScoringSection matches={competitiveMatches} />,
          },
        ]}
      />
    </div>
  );
}
