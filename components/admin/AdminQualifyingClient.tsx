"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Card,
  Collapse,
  Drawer,
  Empty,
  InputNumber,
  Modal,
  Select,
  Space,
  Tabs,
  Tag,
  Typography,
  message,
} from "antd";
import { ScheduleOutlined } from "@ant-design/icons";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import {
  autoAssignCourts,
  autoSelectQualifiers,
  generateQualifyingMatches,
  reportQualifyingScore,
  resetQualifying,
  setQualifyingStatus,
  setCourtQualifiers,
  updateCourtAssignments,
} from "@/app/admin/qualifying/actions";

type Team = { id: string; name: string; qualified?: boolean | null };
type Assignment = {
  id: string;
  court_id: string;
  position: number;
  team: Team | null;
};
type Match = {
  id: string;
  court_id: string;
  match_index: number;
  status: string | null;
  score_a: number | null;
  score_b: number | null;
  team_a: Team | null;
  team_b: Team | null;
  winner: Team | null;
};
type Stat = {
  team_id: string;
  court_id: string;
  wins: number;
  losses: number;
  points_for: number;
  points_against: number;
  differential: number;
};

type BracketData = {
  bracket: {
    id: string;
    type: "recreational" | "competitive";
    qualifying_status?: string | null;
  };
  courts: Array<{ id: string; court_number: number }>;
  assignments: Assignment[];
  matches: Match[];
  stats: Stat[];
  activeTeams: number;
  qualifiedTeams: number;
  teams: Array<{ id: string; name: string }>;
};

/** Draft field: undefined = inherit server; null = user cleared the input (must not fall back via ??). */
type ScoreDraft = Partial<{ scoreA: number | null; scoreB: number | null }>;

function scoreInputValue(
  draft: ScoreDraft | undefined,
  field: "scoreA" | "scoreB",
  server: number | null,
): number | null {
  if (!draft || !Object.prototype.hasOwnProperty.call(draft, field)) {
    return server ?? null;
  }
  const v = draft[field];
  return v === undefined ? server ?? null : v;
}

function resolvedScoreForSave(
  draft: ScoreDraft | undefined,
  field: "scoreA" | "scoreB",
  server: number | null,
): number {
  return scoreInputValue(draft, field, server) ?? 0;
}

function QualifyingSection({ data }: { data: BracketData | null }) {
  const [toast, contextHolder] = message.useMessage();
  const router = useRouter();
  const [savingMatchId, setSavingMatchId] = useState<string | null>(null);
  const [qualifierSelections, setQualifierSelections] = useState<
    Record<string, string[]>
  >({});
  const [editingCourt, setEditingCourt] = useState<string | null>(null);
  const [seedSelections, setSeedSelections] = useState<
    Record<string, Array<string | null>>
  >({});
  const [scoreInputs, setScoreInputs] = useState<Record<string, ScoreDraft>>({});

  const bracket = data?.bracket ?? null;
  const courts = data?.courts ?? [];
  const allTeams = data?.teams ?? [];

  const assignments = useMemo(() => data?.assignments ?? [], [data?.assignments]);
  const matches = useMemo(() => data?.matches ?? [], [data?.matches]);
  const stats = useMemo(() => data?.stats ?? [], [data?.stats]);

  const assignmentsByCourt = useMemo(() => {
    const map = new Map<string, Assignment[]>();
    for (const assignment of assignments) {
      const list = map.get(assignment.court_id) ?? [];
      list.push(assignment);
      map.set(assignment.court_id, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.position - b.position);
    }
    return map;
  }, [assignments]);

  const matchesByCourt = useMemo(() => {
    const map = new Map<string, Match[]>();
    for (const match of matches) {
      const list = map.get(match.court_id) ?? [];
      list.push(match);
      map.set(match.court_id, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.match_index - b.match_index);
    }
    return map;
  }, [matches]);

  const statsByCourt = useMemo(() => {
    const map = new Map<string, Stat[]>();
    for (const stat of stats) {
      const list = map.get(stat.court_id) ?? [];
      list.push(stat);
      map.set(stat.court_id, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => {
        if (b.wins !== a.wins) return b.wins - a.wins;
        if (b.differential !== a.differential)
          return b.differential - a.differential;
        return b.points_for - a.points_for;
      });
    }
    return map;
  }, [stats]);

  if (!data || !bracket) {
    return <Empty description="No bracket found yet." />;
  }

  const handleScoreSave = async (
    matchId: string,
    scoreA: number,
    scoreB: number,
  ) => {
    if (Number.isNaN(scoreA) || Number.isNaN(scoreB)) {
      toast.error("Enter scores for both teams.");
      return;
    }
    setSavingMatchId(matchId);
    try {
      const result = await reportQualifyingScore(matchId, scoreA, scoreB);
      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success("Qualifying score saved.");
        // Clear draft state so inputs show fresh server values after refresh.
        // Otherwise `scoreInputs` keeps overriding `match.score_*` and can look
        // empty or stale if the user edits again before / during refresh.
        await router.refresh();
        setScoreInputs((prev) => {
          const next = { ...prev };
          delete next[matchId];
          return next;
        });
      }
    } finally {
      setSavingMatchId(null);
    }
  };

  const handleAutoAssign = async () => {
    const result = await autoAssignCourts(bracket.type);
    if ("error" in result) {
      toast.error(result.error);
    } else {
      toast.success("Courts assigned.");
      router.refresh();
    }
  };

  const handleGenerate = async () => {
    const result = await generateQualifyingMatches(bracket.type);
    if ("error" in result) {
      toast.error(result.error);
    } else {
      toast.success("Qualifying matches generated.");
      router.refresh();
    }
  };

  const handleAutoQualify = async () => {
    const result = await autoSelectQualifiers(bracket.type);
    if ("error" in result) {
      toast.error(result.error);
    } else {
      toast.success("Top two teams selected for each court.");
      router.refresh();
    }
  };

  const handleReset = async () => {
    const result = await resetQualifying(bracket.type);
    if ("error" in result) {
      toast.error(result.error);
    } else {
      toast.success("Qualifying stage reset.");
      router.refresh();
    }
  };

  const handleSaveQualifiers = async (courtId: string) => {
    const selection = qualifierSelections[courtId] ?? [];
    const result = await setCourtQualifiers(courtId, selection);
    if ("error" in result) {
      toast.error(result.error);
    } else {
      toast.success("Qualifiers updated.");
      router.refresh();
    }
  };

  const handlePublishToggle = async (status: "PUBLISHED" | "DRAFT") => {
    const result = await setQualifyingStatus(bracket.type, status);
    if ("error" in result) {
      toast.error(result.error);
    } else {
      toast.success(
        status === "PUBLISHED"
          ? "Qualifying published."
          : "Qualifying unpublished.",
      );
      router.refresh();
    }
  };

  const handleOpenSeeding = (courtId: string) => {
    const courtAssignments = assignmentsByCourt.get(courtId) ?? [];
    const sorted = [...courtAssignments].sort(
      (a, b) => a.position - b.position,
    );
    setSeedSelections((prev) => ({
      ...prev,
      [courtId]: Array.from(
        { length: 4 },
        (_, idx) => sorted[idx]?.team?.id ?? null,
      ),
    }));
    setEditingCourt(courtId);
  };

  const handleSaveSeeding = async (courtId: string) => {
    const selection = seedSelections[courtId] ?? [];
    const currentAssignments = assignmentsByCourt.get(courtId) ?? [];
    const teamCourtMap = new Map<string, string>();
    for (const [courtKey, list] of assignmentsByCourt.entries()) {
      for (const assignment of list) {
        if (assignment.team?.id) {
          teamCourtMap.set(assignment.team.id, courtKey);
        }
      }
    }

    const conflicts = selection
      .filter((teamId): teamId is string => Boolean(teamId))
      .filter((teamId) => {
        const assignedCourt = teamCourtMap.get(teamId);
        return assignedCourt && assignedCourt !== courtId;
      });

    const onConfirm = async () => {
      const result = await updateCourtAssignments(courtId, selection);
      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success("Court assignments updated.");
        router.refresh();
        setEditingCourt(null);
      }
    };

    if (
      conflicts.length > 0 ||
      selection.filter(Boolean).length !== currentAssignments.length
    ) {
      Modal.confirm({
        title: "Update court assignments?",
        content:
          "This will clear matches for this court and any other court that currently contains these teams.",
        okText: "Update",
        okButtonProps: { danger: true },
        onOk: onConfirm,
      });
      return;
    }

    await onConfirm();
  };

  return (
    <Space direction="vertical" size="large" className="w-full">
      {contextHolder}
      <Card>
        <Space direction="vertical" size="small">
          <Typography.Title level={4} className="!mb-0">
            Qualifying Overview
          </Typography.Title>
          <Typography.Text type="secondary">
            Active teams: {data.activeTeams} · Qualified teams:{" "}
            {data.qualifiedTeams}
          </Typography.Text>
          <Typography.Text type="secondary">
            Courts with 2-4 teams can generate qualifying matches. Top two
            advance when available.
          </Typography.Text>
          <Typography.Text type="secondary">
            Status:{" "}
            <Tag
              color={
                bracket.qualifying_status === "PUBLISHED" ? "green" : "default"
              }
            >
              {bracket.qualifying_status ?? "DRAFT"}
            </Tag>
          </Typography.Text>
          {courts.length > 0 &&
            courts.some(
              (court) => (assignmentsByCourt.get(court.id)?.length ?? 0) < 2,
            ) && (
              <Typography.Text type="warning">
                One or more courts have fewer than 2 teams. Complete assignments
                before generating matches.
              </Typography.Text>
            )}
          <Space wrap>
            <Button type="primary" onClick={handleAutoAssign}>
              Auto-assign Courts
            </Button>
            <Button onClick={handleGenerate}>Generate Matches</Button>
            <Button onClick={handleAutoQualify}>Auto-select Qualifiers</Button>
            {bracket.qualifying_status === "PUBLISHED" ? (
              <Button onClick={() => handlePublishToggle("DRAFT")}>
                Unpublish Qualifying
              </Button>
            ) : (
              <Button onClick={() => handlePublishToggle("PUBLISHED")}>
                Publish Qualifying
              </Button>
            )}
            <Button danger onClick={handleReset}>
              Reset Qualifying
            </Button>
          </Space>
        </Space>
      </Card>

      {courts.length === 0 ? (
        <Empty description="No courts assigned yet." />
      ) : (
        <Collapse
          className="bg-transparent"
          items={courts.map((court) => {
            const courtAssignments = assignmentsByCourt.get(court.id) ?? [];
            const courtMatches = matchesByCourt.get(court.id) ?? [];
            const courtStats = statsByCourt.get(court.id) ?? [];
            const teamOptions = courtAssignments
              .map((assignment) => assignment.team)
              .filter(Boolean)
              .map((team) => ({ label: team!.name, value: team!.id }));

            return {
              key: court.id,
              label: `Court ${court.court_number}`,
              children: (
                <Card bordered={false} className="shadow-none">
                  <Space direction="vertical" size="middle" className="w-full">
                    <Space wrap>
                      <Button onClick={() => handleOpenSeeding(court.id)}>
                        Edit Seeding
                      </Button>
                    </Space>
                    <div>
                      <Typography.Text strong>Teams</Typography.Text>
                      <ul className="mt-2">
                        {courtAssignments.map((assignment) => (
                          <li key={assignment.id}>
                            {assignment.team?.name ?? "Unassigned"}
                            {assignment.team?.qualified ? (
                              <Tag color="green" className="ml-2">
                                Qualified
                              </Tag>
                            ) : null}
                          </li>
                        ))}
                        {courtAssignments.length < 4 ? (
                          <li className="text-gray-500">
                            {4 - courtAssignments.length} open slot(s)
                          </li>
                        ) : null}
                      </ul>
                    </div>

                    <div>
                      <Typography.Text strong>Standings</Typography.Text>
                      {courtStats.length === 0 ? (
                        <Typography.Paragraph
                          type="secondary"
                          className="!mb-0"
                        >
                          No standings yet.
                        </Typography.Paragraph>
                      ) : (
                        <ul className="mt-2 space-y-1">
                          {courtStats.map((stat) => {
                            const team = courtAssignments.find(
                              (assignment) =>
                                assignment.team?.id === stat.team_id,
                            )?.team;
                            return (
                              <li
                                key={stat.team_id}
                                className="flex flex-wrap items-center gap-2"
                              >
                                <span>{team?.name ?? "Team"}</span>
                                <Tag>
                                  {stat.wins}-{stat.losses}
                                </Tag>
                                <Tag color="blue">Diff {stat.differential}</Tag>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>

                    <div>
                      <Typography.Text strong>Matches</Typography.Text>
                      {courtMatches.length === 0 ? (
                        <Typography.Paragraph
                          type="secondary"
                          className="!mb-0"
                        >
                          Matches not generated yet.
                        </Typography.Paragraph>
                      ) : (
                        <Space direction="vertical" className="w-full">
                          {courtMatches.map((match) => (
                            <Card key={match.id} size="small">
                              <Typography.Text type="secondary">
                                Game {match.match_index}
                              </Typography.Text>
                              <div className="mt-2">
                                <Typography.Text>
                                  {match.team_a?.name ?? "TBD"} vs{" "}
                                  {match.team_b?.name ?? "TBD"}
                                </Typography.Text>
                              </div>
                              <div className="mt-2">
                                <Space wrap>
                                  <InputNumber
                                    min={0}
                                    placeholder="Score A"
                                    value={scoreInputValue(
                                      scoreInputs[match.id],
                                      "scoreA",
                                      match.score_a,
                                    )}
                                    onChange={(value) =>
                                      setScoreInputs((prev) => ({
                                        ...prev,
                                        [match.id]: {
                                          ...prev[match.id],
                                          scoreA:
                                            value === null || value === undefined
                                              ? null
                                              : value,
                                        },
                                      }))
                                    }
                                  />
                                  <InputNumber
                                    min={0}
                                    placeholder="Score B"
                                    value={scoreInputValue(
                                      scoreInputs[match.id],
                                      "scoreB",
                                      match.score_b,
                                    )}
                                    onChange={(value) =>
                                      setScoreInputs((prev) => ({
                                        ...prev,
                                        [match.id]: {
                                          ...prev[match.id],
                                          scoreB:
                                            value === null || value === undefined
                                              ? null
                                              : value,
                                        },
                                      }))
                                    }
                                  />
                                  <Button
                                    type="primary"
                                    loading={savingMatchId === match.id}
                                    onClick={() => {
                                      const draft = scoreInputs[match.id];
                                      const scoreA = resolvedScoreForSave(
                                        draft,
                                        "scoreA",
                                        match.score_a,
                                      );
                                      const scoreB = resolvedScoreForSave(
                                        draft,
                                        "scoreB",
                                        match.score_b,
                                      );
                                      handleScoreSave(match.id, scoreA, scoreB);
                                    }}
                                  >
                                    Save
                                  </Button>
                                </Space>
                              </div>
                              {match.status === "COMPLETED" ? (
                                <Tag color="blue">
                                  Final {match.score_a}-{match.score_b}
                                </Tag>
                              ) : null}
                            </Card>
                          ))}
                        </Space>
                      )}
                    </div>

                    <div>
                      <Typography.Text strong>
                        Manual Qualifiers
                      </Typography.Text>
                      <Space direction="vertical" className="w-full mt-2">
                        <Select
                          mode="multiple"
                          maxCount={2}
                          placeholder="Select advancing teams"
                          className="w-full"
                          options={teamOptions}
                          value={qualifierSelections[court.id]}
                          onChange={(value) =>
                            setQualifierSelections((prev) => ({
                              ...prev,
                              [court.id]: value,
                            }))
                          }
                        />
                        <Button onClick={() => handleSaveQualifiers(court.id)}>
                          Save Qualifiers
                        </Button>
                      </Space>
                    </div>
                  </Space>
                </Card>
              ),
            };
          })}
        />
      )}

      <Drawer
        open={Boolean(editingCourt)}
        onClose={() => setEditingCourt(null)}
        title="Edit Seeding"
        size="large"
      >
        {editingCourt ? (
          <Space direction="vertical" className="w-full">
            <Typography.Text type="secondary">
              Updating seeding clears matches for this court and any other court
              that had these teams assigned.
            </Typography.Text>
            {[0, 1, 2, 3].map((idx) => (
              <Select
                key={idx}
                placeholder={`Slot ${idx + 1}`}
                allowClear
                options={allTeams.map((team) => ({
                  label: team.name,
                  value: team.id,
                }))}
                value={seedSelections[editingCourt]?.[idx] ?? null}
                onChange={(value) =>
                  setSeedSelections((prev) => ({
                    ...prev,
                    [editingCourt]: [
                      ...(prev[editingCourt] ?? [null, null, null, null]),
                    ].map((entry, index) =>
                      index === idx ? (value ?? null) : (entry ?? null),
                    ),
                  }))
                }
              />
            ))}
            <Space wrap>
              <Button onClick={() => setEditingCourt(null)}>Cancel</Button>
              <Button
                type="primary"
                onClick={() => handleSaveSeeding(editingCourt)}
              >
                Save Seeding
              </Button>
            </Space>
          </Space>
        ) : null}
      </Drawer>
    </Space>
  );
}

export function AdminQualifyingClient({
  recreational,
  competitive,
}: {
  recreational: BracketData | null;
  competitive: BracketData | null;
}) {
  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <AdminPageHeader
        title="Qualifying"
        subtitle="Assign teams, record round robin results, and select the top two teams per court."
        icon={<ScheduleOutlined />}
        tooltip="Teams play a round robin within their court. Rankings use wins, then point differential, then points scored. The top two teams advance to the bracket."
      />
      <Tabs
        items={[
          {
            key: "recreational",
            label: "Recreational",
            children: <QualifyingSection data={recreational} />,
          },
          {
            key: "competitive",
            label: "Competitive",
            children: <QualifyingSection data={competitive} />,
          },
        ]}
      />
    </div>
  );
}
