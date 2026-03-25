import { requireAdmin } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { Button, Card, Col, Row, Space, Tag, Typography } from "antd";
import { generateBracket } from "./actions";

async function getBracketSummary(type: "recreational" | "competitive") {
  const { data: bracket } = await supabase
    .from("brackets")
    .select("id, type, status")
    .eq("type", type)
    .single();

  if (!bracket) {
    return null;
  }

  const { count: activeTeamCount } = await supabase
    .from("teams")
    .select("id", { count: "exact", head: true })
    .eq("bracket_id", bracket.id)
    .eq("is_active", true);

  const { count: matchCount } = await supabase
    .from("matches")
    .select("id", { count: "exact", head: true })
    .eq("bracket_id", bracket.id);

  return {
    ...bracket,
    activeTeamCount: activeTeamCount ?? 0,
    matchCount: matchCount ?? 0,
  };
}

export default async function AdminBracketsPage() {
  await requireAdmin();

  const recreational = await getBracketSummary("recreational");
  const competitive = await getBracketSummary("competitive");

  const brackets = [recreational, competitive].filter(Boolean);

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <Typography.Title level={2}>Bracket Generation</Typography.Title>
      <Typography.Paragraph type="secondary">
        Generate the tournament bracket once registration is finalized. This
        creates all matches for the selected bracket and handles byes
        automatically.
      </Typography.Paragraph>

      <Row gutter={[16, 16]}>
        {brackets.map((bracket) => (
          <Col xs={24} md={12} key={bracket!.id}>
            <Card style={{ borderRadius: 16 }}>
              <Space direction="vertical" size={12} className="w-full">
                <div className="flex items-center justify-between">
                  <Typography.Title level={4} style={{ margin: 0 }}>
                    {bracket!.type === "recreational"
                      ? "Recreational"
                      : "Competitive"}
                  </Typography.Title>
                  <Tag
                    color={bracket!.status === "GENERATED" ? "green" : "blue"}
                  >
                    {bracket!.status}
                  </Tag>
                </div>

                <Typography.Text>
                  Active teams: {bracket!.activeTeamCount}
                </Typography.Text>

                <Typography.Text>
                  Existing matches: {bracket!.matchCount}
                </Typography.Text>

                <form
                  action={async () => {
                    "use server";
                    await generateBracket(
                      bracket!.type as "recreational" | "competitive",
                    );
                  }}
                >
                  <Button
                    type="primary"
                    htmlType="submit"
                    disabled={
                      bracket!.activeTeamCount < 2 || bracket!.matchCount > 0
                    }
                  >
                    Generate Bracket
                  </Button>
                </form>
              </Space>
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );
}
