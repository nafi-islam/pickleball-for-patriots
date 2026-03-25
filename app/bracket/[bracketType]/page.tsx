import { supabase } from "@/lib/supabase";
import { Card, Col, Row, Space, Tag, Typography } from "antd";
import { notFound } from "next/navigation";

type PageProps = {
  params: Promise<{ bracketType: string }>;
};

export default async function PublicBracketPage({ params }: PageProps) {
  const { bracketType } = await params;

  if (!["recreational", "competitive"].includes(bracketType)) {
    notFound();
  }

  const { data: bracket } = await supabase
    .from("brackets")
    .select("id, type, status")
    .eq("type", bracketType)
    .single();

  if (!bracket) {
    notFound();
  }

  const { data: matches } = await supabase
    .from("matches")
    .select(
      `
      id,
      round,
      index_in_round,
      status,
      team_a:team_a_id ( id, name ),
      team_b:team_b_id ( id, name ),
      winner:winner_team_id ( id, name )
    `,
    )
    .eq("bracket_id", bracket.id)
    .order("round", { ascending: true })
    .order("index_in_round", { ascending: true });

  const grouped = new Map<number, typeof matches>();

  for (const match of matches ?? []) {
    if (!grouped.has(match.round)) {
      grouped.set(match.round, []);
    }
    grouped.get(match.round)!.push(match);
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <Typography.Title level={2}>
        {bracketType === "recreational" ? "Recreational" : "Competitive"}{" "}
        Bracket
      </Typography.Title>

      <Typography.Paragraph type="secondary">
        Status: {bracket.status}
      </Typography.Paragraph>

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

                    <Typography.Text>
                      {match.team_a?.name ?? "TBD"}
                    </Typography.Text>

                    <Typography.Text>
                      {match.team_b?.name ?? "TBD"}
                    </Typography.Text>

                    {match.winner?.name ? (
                      <Tag color="green">Winner: {match.winner.name}</Tag>
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
    </div>
  );
}
