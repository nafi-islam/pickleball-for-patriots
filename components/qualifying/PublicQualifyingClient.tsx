"use client";

import { Card, Collapse, Empty, Space, Tag, Typography } from "antd";

type Team = { id: string; name: string };
type Assignment = {
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

type Props = {
  bracketType: "recreational" | "competitive";
  status: string;
  courts: Array<{ id: string; court_number: number }>;
  assignments: Assignment[];
  matches: Match[];
  stats: Stat[];
};

export function PublicQualifyingClient({
  bracketType,
  status,
  courts,
  assignments,
  matches,
  stats,
}: Props) {
  if (status !== "PUBLISHED") {
    return (
      <div className="max-w-6xl mx-auto px-6 py-8">
        <Typography.Title level={2}>
          {bracketType === "recreational" ? "Recreational" : "Competitive"}{" "}
          Qualifying
        </Typography.Title>
        <Card style={{ borderRadius: 12 }}>
          <Empty description="Qualifying has not been published yet." />
        </Card>
      </div>
    );
  }

  if (courts.length === 0) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-8">
        <Typography.Title level={2}>
          {bracketType === "recreational" ? "Recreational" : "Competitive"}{" "}
          Qualifying
        </Typography.Title>
        <Card style={{ borderRadius: 12 }}>
          <Empty description="Qualifying courts have not been set yet." />
        </Card>
      </div>
    );
  }

  const assignmentsByCourt = new Map<string, Assignment[]>();
  for (const assignment of assignments) {
    const list = assignmentsByCourt.get(assignment.court_id) ?? [];
    list.push(assignment);
    assignmentsByCourt.set(assignment.court_id, list);
  }
  for (const list of assignmentsByCourt.values()) {
    list.sort((a, b) => a.position - b.position);
  }

  const matchesByCourt = new Map<string, Match[]>();
  for (const match of matches) {
    const list = matchesByCourt.get(match.court_id) ?? [];
    list.push(match);
    matchesByCourt.set(match.court_id, list);
  }
  for (const list of matchesByCourt.values()) {
    list.sort((a, b) => a.match_index - b.match_index);
  }

  const statsByCourt = new Map<string, Stat[]>();
  for (const stat of stats) {
    const list = statsByCourt.get(stat.court_id) ?? [];
    list.push(stat);
    statsByCourt.set(stat.court_id, list);
  }
  for (const list of statsByCourt.values()) {
    list.sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (b.differential !== a.differential) return b.differential - a.differential;
      return b.points_for - a.points_for;
    });
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <Typography.Title level={2}>
        {bracketType === "recreational" ? "Recreational" : "Competitive"}{" "}
        Qualifying
      </Typography.Title>
      <Typography.Paragraph type="secondary">
        Courts play a 4-team round robin. The top two teams by wins (then point
        differential) advance to the bracket.
      </Typography.Paragraph>
      <Collapse
        className="bg-transparent"
        items={courts.map((court) => {
          const courtAssignments = assignmentsByCourt.get(court.id) ?? [];
          const courtMatches = matchesByCourt.get(court.id) ?? [];
          const courtStats = statsByCourt.get(court.id) ?? [];

          return {
            key: court.id,
            label: `Court ${court.court_number}`,
            children: (
              <Card bordered={false} className="shadow-none">
                <Space direction="vertical" size="middle" className="w-full">
                  <div>
                    <Typography.Text strong>Teams</Typography.Text>
                    <ul className="mt-2 space-y-1">
                      {courtAssignments.map((assignment) => (
                        <li key={`${assignment.court_id}-${assignment.position}`}>
                          {assignment.team?.name ?? "TBD"}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <Typography.Text strong>Standings</Typography.Text>
                    {courtStats.length === 0 ? (
                      <Typography.Paragraph type="secondary" className="!mb-0">
                        Standings update as scores are recorded.
                      </Typography.Paragraph>
                    ) : (
                      <ul className="mt-2 space-y-1">
                        {courtStats.map((stat, idx) => {
                          const teamName =
                            courtAssignments.find(
                              (assignment) => assignment.team?.id === stat.team_id,
                            )?.team?.name ?? "Team";
                          return (
                            <li key={stat.team_id} className="flex flex-wrap items-center gap-2">
                              <span>{teamName}</span>
                              <Tag>{stat.wins}-{stat.losses}</Tag>
                              <Tag color="blue">Diff {stat.differential}</Tag>
                              {idx < 2 ? <Tag color="green">Top 2</Tag> : null}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>

                  <div>
                    <Typography.Text strong>Schedule</Typography.Text>
                    {courtMatches.length === 0 ? (
                      <Typography.Paragraph type="secondary" className="!mb-0">
                        Matches not generated yet.
                      </Typography.Paragraph>
                    ) : (
                      <ul className="mt-2 space-y-1">
                        {courtMatches.map((match) => (
                          <li key={match.id} className="flex flex-wrap items-center gap-2">
                            <span>
                              {match.team_a?.name ?? "TBD"} vs{" "}
                              {match.team_b?.name ?? "TBD"}
                            </span>
                            {match.status === "COMPLETED" ? (
                              <Tag color="blue">
                                {match.score_a}-{match.score_b}
                              </Tag>
                            ) : (
                              <Tag>Pending</Tag>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </Space>
              </Card>
            ),
          };
        })}
      />
    </div>
  );
}
