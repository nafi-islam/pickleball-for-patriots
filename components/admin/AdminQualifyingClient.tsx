"use client";

import { useMemo, useState } from "react";
import {
  Button,
  Card,
  Col,
  Empty,
  InputNumber,
  Row,
  Select,
  Space,
  Tabs,
  Tag,
  Typography,
  message,
} from "antd";
import {
  autoAssignCourts,
  autoSelectQualifiers,
  generateQualifyingMatches,
  reportQualifyingScore,
  resetQualifying,
  setCourtQualifiers,
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
  bracket: { id: string; type: "recreational" | "competitive" };
  courts: Array<{ id: string; court_number: number }>;
  assignments: Assignment[];
  matches: Match[];
  stats: Stat[];
  activeTeams: number;
  qualifiedTeams: number;
};

function QualifyingSection({ data }: { data: BracketData | null }) {
  const [toast, contextHolder] = message.useMessage();
  const [savingMatchId, setSavingMatchId] = useState<string | null>(null);
  const [qualifierSelections, setQualifierSelections] = useState<
    Record<string, string[]>
  >({});
  const [scoreInputs, setScoreInputs] = useState<
    Record<string, { scoreA: number | null; scoreB: number | null }>
  >({});

  if (!data) {
    return <Empty description="No bracket found yet." />;
  }

  const { bracket, courts, assignments, matches, stats } = data;

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
        if (b.differential !== a.differential) return b.differential - a.differential;
        return b.points_for - a.points_for;
      });
    }
    return map;
  }, [stats]);

  const handleScoreSave = async (
    matchId: string,
    scoreA: number,
    scoreB: number,
  ) => {
    setSavingMatchId(matchId);
    try {
      if (Number.isNaN(scoreA) || Number.isNaN(scoreB)) {
        throw new Error("Enter scores for both teams.");
      }
      await reportQualifyingScore(matchId, scoreA, scoreB);
      toast.success("Qualifying score saved.");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setSavingMatchId(null);
    }
  };

  const handleAutoAssign = async () => {
    try {
      await autoAssignCourts(bracket.type);
      toast.success("Courts assigned.");
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const handleGenerate = async () => {
    try {
      await generateQualifyingMatches(bracket.type);
      toast.success("Qualifying matches generated.");
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const handleAutoQualify = async () => {
    try {
      await autoSelectQualifiers(bracket.type);
      toast.success("Top two teams selected for each court.");
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const handleReset = async () => {
    try {
      await resetQualifying(bracket.type);
      toast.success("Qualifying stage reset.");
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const handleSaveQualifiers = async (courtId: string) => {
    const selection = qualifierSelections[courtId] ?? [];
    try {
      await setCourtQualifiers(courtId, selection);
      toast.success("Qualifiers updated.");
    } catch (error) {
      toast.error((error as Error).message);
    }
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
          <Space wrap>
            <Button type="primary" onClick={handleAutoAssign}>
              Auto-assign Courts
            </Button>
            <Button onClick={handleGenerate}>Generate Matches</Button>
            <Button onClick={handleAutoQualify}>Auto-select Qualifiers</Button>
            <Button danger onClick={handleReset}>
              Reset Qualifying
            </Button>
          </Space>
        </Space>
      </Card>

      {courts.length === 0 ? (
        <Empty description="No courts assigned yet." />
      ) : (
        <Row gutter={[16, 16]}>
          {courts.map((court) => {
            const courtAssignments = assignmentsByCourt.get(court.id) ?? [];
            const courtMatches = matchesByCourt.get(court.id) ?? [];
            const courtStats = statsByCourt.get(court.id) ?? [];
            const teamOptions = courtAssignments
              .map((assignment) => assignment.team)
              .filter(Boolean)
              .map((team) => ({ label: team!.name, value: team!.id }));

            return (
              <Col xs={24} lg={12} key={court.id}>
                <Card title={`Court ${court.court_number}`}>
                  <Space direction="vertical" size="middle" className="w-full">
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
                      </ul>
                    </div>

                    <div>
                      <Typography.Text strong>Standings</Typography.Text>
                      {courtStats.length === 0 ? (
                        <Typography.Paragraph type="secondary" className="!mb-0">
                          No standings yet.
                        </Typography.Paragraph>
                      ) : (
                        <ul className="mt-2">
                          {courtStats.map((stat) => {
                            const team = courtAssignments.find(
                              (assignment) => assignment.team?.id === stat.team_id,
                            )?.team;
                            return (
                              <li key={stat.team_id}>
                                {team?.name ?? "Team"} · {stat.wins}-{stat.losses} ·
                                Diff {stat.differential}
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>

                    <div>
                      <Typography.Text strong>Matches</Typography.Text>
                      {courtMatches.length === 0 ? (
                        <Typography.Paragraph type="secondary" className="!mb-0">
                          Matches not generated yet.
                        </Typography.Paragraph>
                      ) : (
                        <Space direction="vertical" className="w-full">
                          {courtMatches.map((match) => (
                            <Card key={match.id} size="small">
                              <Typography.Text>
                                Match {match.match_index}
                              </Typography.Text>
                              <div className="mt-2">
                                <Typography.Text>
                                  {match.team_a?.name ?? "TBD"} vs{" "}
                                  {match.team_b?.name ?? "TBD"}
                                </Typography.Text>
                              </div>
                              <div className="mt-2">
                                <Space>
                                  <InputNumber
                                    min={0}
                                    placeholder="Score A"
                                    value={
                                      scoreInputs[match.id]?.scoreA ??
                                      match.score_a ??
                                      null
                                    }
                                    onChange={(value) =>
                                      setScoreInputs((prev) => ({
                                        ...prev,
                                        [match.id]: {
                                          scoreA: value ?? null,
                                          scoreB:
                                            prev[match.id]?.scoreB ??
                                            match.score_b ??
                                            null,
                                        },
                                      }))
                                    }
                                  />
                                  <InputNumber
                                    min={0}
                                    placeholder="Score B"
                                    value={
                                      scoreInputs[match.id]?.scoreB ??
                                      match.score_b ??
                                      null
                                    }
                                    onChange={(value) =>
                                      setScoreInputs((prev) => ({
                                        ...prev,
                                        [match.id]: {
                                          scoreA:
                                            prev[match.id]?.scoreA ??
                                            match.score_a ??
                                            null,
                                          scoreB: value ?? null,
                                        },
                                      }))
                                    }
                                  />
                                  <Button
                                    type="primary"
                                    loading={savingMatchId === match.id}
                                    onClick={() => {
                                      const scoreA =
                                        scoreInputs[match.id]?.scoreA ??
                                        match.score_a ??
                                        0;
                                      const scoreB =
                                        scoreInputs[match.id]?.scoreB ??
                                        match.score_b ??
                                        0;
                                      handleScoreSave(match.id, scoreA, scoreB);
                                    }}
                                  >
                                    Save
                                  </Button>
                                </Space>
                              </div>
                              {match.status === "COMPLETED" ? (
                                <Typography.Text type="secondary">
                                  Final: {match.score_a} - {match.score_b}
                                </Typography.Text>
                              ) : null}
                            </Card>
                          ))}
                        </Space>
                      )}
                    </div>

                    <div>
                      <Typography.Text strong>Manual Qualifiers</Typography.Text>
                      <Space direction="vertical" className="w-full mt-2">
                        <Select
                          mode="multiple"
                          maxCount={2}
                          placeholder="Select two advancing teams"
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
              </Col>
            );
          })}
        </Row>
      )}
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
      <Typography.Title level={2}>Qualifying Courts</Typography.Title>
      <Typography.Paragraph type="secondary">
        Assign teams to courts, record round robin results, and confirm the top
        two teams advancing to the bracket.
      </Typography.Paragraph>
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
