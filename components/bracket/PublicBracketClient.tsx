"use client";

import { Card, Col, Empty, Row, Space, Tag, Typography } from "antd";

type MatchRow = {
  id: string;
  round: number;
  index_in_round: number;
  status: string;
  score_a?: number | null;
  score_b?: number | null;
  court?: string | null;
  team_a?: { id: string; name: string } | null;
  team_b?: { id: string; name: string } | null;
  winner?: { id: string; name: string } | null;
};

type Props = {
  bracketType: "recreational" | "competitive";
  status: string;
  matches: MatchRow[];
};

export function PublicBracketClient({ bracketType, status, matches }: Props) {
  if (status !== "PUBLISHED") {
    return (
      <div className="max-w-6xl mx-auto px-6 py-8">
        <Typography.Title level={2}>
          {bracketType === "recreational" ? "Recreational" : "Competitive"}{" "}
          Bracket
        </Typography.Title>
        <Card style={{ borderRadius: 12 }}>
          <Empty description="Bracket has not been published yet." />
        </Card>
      </div>
    );
  }

  const grouped = new Map<number, MatchRow[]>();

  for (const match of matches) {
    if (!grouped.has(match.round)) {
      grouped.set(match.round, []);
    }
    grouped.get(match.round)!.push(match);
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <Typography.Title level={2}>
        {bracketType === "recreational" ? "Recreational" : "Competitive"} Bracket
      </Typography.Title>

      <Typography.Paragraph type="secondary">
        Status: {status}
      </Typography.Paragraph>

      {matches.length === 0 ? (
        <Card style={{ borderRadius: 12 }}>
          <Empty description="Bracket matches have not been generated yet." />
        </Card>
      ) : (
        <Row gutter={[16, 16]}>
          {[...grouped.entries()].map(([round, roundMatches]) => (
            <Col xs={24} md={12} lg={8} key={round}>
              <Space direction="vertical" size={12} className="w-full">
                <Typography.Title level={4}>Round {round}</Typography.Title>

                {roundMatches.map((match) => (
                  <Card key={match.id} style={{ borderRadius: 12 }}>
                    <Space direction="vertical" size={6} className="w-full">
                <Typography.Text strong>
                  Match {match.index_in_round}
                </Typography.Text>
                {match.court && (
                  <Typography.Text type="secondary">
                    {match.court}
                  </Typography.Text>
                )}

                <Typography.Text>
                  {match.team_a?.name ?? "TBD"}
                </Typography.Text>

                      <Typography.Text>
                        {match.team_b?.name ?? "TBD"}
                      </Typography.Text>

                    {match.winner?.name ? (
                      <Tag color="green">
                        Winner: {match.winner.name}
                        {match.status === "COMPLETED" &&
                          match.score_a !== null &&
                          match.score_b !== null && (
                            <span className="ml-2 text-xs">
                              ({match.score_a}-{match.score_b})
                            </span>
                          )}
                      </Tag>
                    ) : (
                      <Tag>Pending</Tag>
                    )}
                    </Space>
                  </Card>
                ))}
              </Space>
            </Col>
          ))}
        </Row>
      )}
    </div>
  );
}
