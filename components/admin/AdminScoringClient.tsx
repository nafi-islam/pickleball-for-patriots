"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import {
  Card,
  Empty,
  Select,
  Space,
  Tabs,
  Tag,
  Typography,
  message,
} from "antd";
import { CheckCircleOutlined } from "@ant-design/icons";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import ScoreForm from "@/components/admin/ScoreForm";
import { setMatchCourt } from "@/app/admin/scoring/actions";

type MatchRow = {
  id: string;
  round: number;
  index_in_round: number;
  status: string;
  score_a: number | null;
  score_b: number | null;
  court: string | null;
  team_a?: { id: string; name: string } | null;
  team_b?: { id: string; name: string } | null;
  winner?: { id: string; name: string } | null;
};

function BracketScoringSection({ matches }: { matches: MatchRow[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [messageApi, contextHolder] = message.useMessage();

  const courtOptions = Array.from({ length: 8 }, (_, index) => ({
    label: `Court ${index + 1}`,
    value: index + 1,
  }));

  if (matches.length === 0) {
    return (
      <Card style={{ borderRadius: 12 }}>
        <Empty description="No matches yet for this bracket." />
      </Card>
    );
  }

  return (
    <Space direction="vertical" size={16} className="w-full">
      {contextHolder}
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

              <Select
                placeholder="Assign court"
                allowClear
                value={
                  match.court
                    ? Number(match.court.replace("Court ", ""))
                    : undefined
                }
                options={courtOptions}
                disabled={isPending}
                onChange={(value) =>
                  startTransition(async () => {
                    const result = await setMatchCourt({
                      matchId: match.id,
                      court: value ?? null,
                    });
                    if ("error" in result) {
                      messageApi.error(result.error);
                    } else {
                      messageApi.success("Court updated.");
                      router.refresh();
                    }
                  })
                }
              />

              {match.status === "COMPLETED" ? (
                <Typography.Text type="secondary">
                  Final: {match.score_a} - {match.score_b}
                </Typography.Text>
              ) : ready ? (
                <ScoreForm
                  matchId={match.id}
                  teamAName={match.team_a?.name ?? "Team A"}
                  teamBName={match.team_b?.name ?? "Team B"}
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
      <AdminPageHeader
        title="Scoring"
        subtitle="Record match results and automatically advance winners."
        icon={<CheckCircleOutlined />}
      />

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
