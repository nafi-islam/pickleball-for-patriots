"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  Button,
  Card,
  Divider,
  Drawer,
  Empty,
  Modal,
  Select,
  Space,
  Tabs,
  Tag,
  Typography,
  message,
} from "antd";
import { TrophyOutlined } from "@ant-design/icons";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import {
  generateBracket,
  resetBracket,
  setBracketStatus,
  updateMatchParticipants,
} from "@/app/admin/brackets/actions";

type BracketSummary = {
  id: string;
  type: "recreational" | "competitive";
  status: string;
  activeTeamCount: number;
  qualifiedTeamCount: number;
  courtCount: number;
  matchCount: number;
  teams: Array<{ id: string; name: string }>;
  roundOneMatches: Array<{
    id: string;
    index_in_round: number;
    team_a_id: string | null;
    team_b_id: string | null;
  }>;
};

export function AdminBracketsClient({
  brackets,
}: {
  brackets: BracketSummary[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [messageApi, contextHolder] = message.useMessage();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeBracket, setActiveBracket] = useState<BracketSummary | null>(
    null,
  );
  const [matchEdits, setMatchEdits] = useState<
    Record<string, { teamAId: string | null; teamBId: string | null }>
  >({});

  const handleGenerate = (type: BracketSummary["type"]) => {
    startTransition(async () => {
      const result = await generateBracket(type);
      if ("error" in result) {
        messageApi.error(result.error);
      } else {
        messageApi.success("Bracket generated.");
        router.refresh();
      }
    });
  };

  const handlePublish = (type: BracketSummary["type"]) => {
    startTransition(async () => {
      const result = await setBracketStatus(type, "PUBLISHED");
      if ("error" in result) {
        messageApi.error(result.error);
      } else {
        messageApi.success("Bracket published.");
        router.refresh();
      }
    });
  };

  const handleUnpublish = (type: BracketSummary["type"]) => {
    startTransition(async () => {
      const result = await setBracketStatus(type, "GENERATED");
      if ("error" in result) {
        messageApi.error(result.error);
      } else {
        messageApi.success("Bracket unpublished.");
        router.refresh();
      }
    });
  };

  const handleReset = (type: BracketSummary["type"]) => {
    Modal.confirm({
      title: "Reset bracket?",
      content:
        "This will delete all matches for this bracket and set its status back to DRAFT.",
      okText: "Reset",
      okButtonProps: { danger: true },
      onOk: () =>
        startTransition(async () => {
          const result = await resetBracket(type);
          if ("error" in result) {
            messageApi.error(result.error);
          } else {
            messageApi.success("Bracket reset.");
            router.refresh();
          }
        }),
    });
  };

  const openSeeding = (bracket: BracketSummary) => {
    setActiveBracket(bracket);
    const initial: Record<
      string,
      { teamAId: string | null; teamBId: string | null }
    > = {};
    for (const match of bracket.roundOneMatches) {
      initial[match.id] = {
        teamAId: match.team_a_id ?? null,
        teamBId: match.team_b_id ?? null,
      };
    }
    setMatchEdits(initial);
    setDrawerOpen(true);
  };

  const teamOptions = useMemo(() => {
    if (!activeBracket) return [];
    return activeBracket.teams.map((team) => ({
      label: team.name,
      value: team.id,
    }));
  }, [activeBracket]);

  const handleSaveMatch = (
    matchId: string,
    teamAId: string | null,
    teamBId: string | null,
  ) => {
    startTransition(async () => {
      const result = await updateMatchParticipants(matchId, teamAId, teamBId);
      if ("error" in result) {
        messageApi.error(result.error);
      } else {
        messageApi.success("Match updated.");
        router.refresh();
      }
    });
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      {contextHolder}
      <AdminPageHeader
        title="Brackets"
        subtitle="Generate the elimination bracket from qualified teams and publish it for players."
        icon={<TrophyOutlined />}
        tooltip="Brackets use qualified teams when courts exist. Teams are seeded by registration order. Byes fill empty slots to reach a power of two."
      />

      {brackets.length === 0 ? (
        <Card style={{ borderRadius: 16 }}>
          <Empty description="No brackets found. Seed the recreational and competitive brackets first." />
        </Card>
      ) : (
        <Tabs
          items={brackets.map((bracket) => {
            const needsQualified =
              bracket.courtCount > 0 && bracket.qualifiedTeamCount < 2;

            const generationDisabled =
              bracket.activeTeamCount < 2 ||
              bracket.matchCount > 0 ||
              bracket.status === "GENERATED" ||
              bracket.status === "PUBLISHED" ||
              needsQualified ||
              isPending;
            const canPublish =
              bracket.matchCount > 0 && bracket.status !== "PUBLISHED";
            const canUnpublish = bracket.status === "PUBLISHED";

            return {
              key: bracket.id,
              label:
                bracket.type === "recreational"
                  ? "Recreational"
                  : "Competitive",
              children: (
                <Card style={{ borderRadius: 16 }}>
                  <Space direction="vertical" size={12} className="w-full">
                    <div className="flex items-center justify-between">
                      <Typography.Title level={4} style={{ margin: 0 }}>
                        {bracket.type === "recreational"
                          ? "Recreational"
                          : "Competitive"}
                      </Typography.Title>
                      <Tag
                        color={
                          bracket.status === "GENERATED" ? "green" : "blue"
                        }
                      >
                        {bracket.status}
                      </Tag>
                    </div>

                    <Typography.Text>
                      Active teams: {bracket.activeTeamCount}
                    </Typography.Text>

                    {bracket.courtCount > 0 && (
                      <Typography.Text>
                        Qualified teams: {bracket.qualifiedTeamCount}
                      </Typography.Text>
                    )}

                    <Typography.Text>
                      Existing matches: {bracket.matchCount}
                    </Typography.Text>
                    {needsQualified && (
                      <Typography.Text type="warning">
                        Qualifying is not complete. Select advancing teams
                        before generating the bracket.
                      </Typography.Text>
                    )}

                    <Space wrap>
                      <Button
                        type="primary"
                        disabled={generationDisabled}
                        loading={isPending}
                        onClick={() => handleGenerate(bracket.type)}
                      >
                        Generate Bracket
                      </Button>
                      {canPublish && (
                        <Button
                          disabled={isPending}
                          onClick={() => handlePublish(bracket.type)}
                        >
                          Publish
                        </Button>
                      )}
                      {canUnpublish && (
                        <Button
                          disabled={isPending}
                          onClick={() => handleUnpublish(bracket.type)}
                        >
                          Unpublish
                        </Button>
                      )}
                      <Button onClick={() => openSeeding(bracket)}>
                        Edit Seeding
                      </Button>
                      <Button danger onClick={() => handleReset(bracket.type)}>
                        Reset Bracket
                      </Button>
                    </Space>
                  </Space>
                </Card>
              ),
            };
          })}
        />
      )}

      <Drawer
        title={
          activeBracket?.type === "recreational"
            ? "Edit Recreational Seeding"
            : "Edit Competitive Seeding"
        }
        open={drawerOpen}
        size="large"
        onClose={() => {
          setDrawerOpen(false);
          setActiveBracket(null);
          setMatchEdits({});
        }}
      >
        <Typography.Paragraph type="secondary">
          Manual seeding does not clear scores or downstream matches. Use with
          care during live play.
        </Typography.Paragraph>
        <Divider />
        {activeBracket?.roundOneMatches.length ? (
          <Space direction="vertical" size={12} className="w-full">
            {activeBracket.roundOneMatches.map((match) => (
              <Card key={match.id} size="small">
                <Space direction="vertical" size={8} className="w-full">
                  <Typography.Text strong>
                    Round 1 · Match {match.index_in_round}
                  </Typography.Text>
                  <Select
                    allowClear
                    placeholder="Team A"
                    options={teamOptions}
                    value={matchEdits[match.id]?.teamAId ?? undefined}
                    onChange={(value) =>
                      setMatchEdits((prev) => ({
                        ...prev,
                        [match.id]: {
                          teamAId: value ?? null,
                          teamBId: prev[match.id]?.teamBId ?? null,
                        },
                      }))
                    }
                  />
                  <Select
                    allowClear
                    placeholder="Team B"
                    options={teamOptions}
                    value={matchEdits[match.id]?.teamBId ?? undefined}
                    onChange={(value) =>
                      setMatchEdits((prev) => ({
                        ...prev,
                        [match.id]: {
                          teamAId: prev[match.id]?.teamAId ?? null,
                          teamBId: value ?? null,
                        },
                      }))
                    }
                  />
                  <Button
                    type="primary"
                    size="small"
                    disabled={isPending}
                    onClick={() =>
                      handleSaveMatch(
                        match.id,
                        matchEdits[match.id]?.teamAId ?? null,
                        matchEdits[match.id]?.teamBId ?? null,
                      )
                    }
                  >
                    Save
                  </Button>
                </Space>
              </Card>
            ))}
          </Space>
        ) : (
          <Empty description="No round 1 matches yet. Generate the bracket first." />
        )}
      </Drawer>
    </div>
  );
}
