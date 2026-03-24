"use client";

import Link from "next/link";
import { Badge, Button, Card, Col, Row, Space, Tag, Typography } from "antd";

type Stats = {
  totalTeams: number;
  activeTeams: number;
  withdrawnTeams: number;
  totalPlayers: number;
  recreationalTeams: number;
  competitiveTeams: number;
  maxTeams: number;
};

type TournamentOverview = {
  name?: string | null;
  location?: string | null;
  event_date?: string | null;
  status?: string | null;
  updated_at?: string | null;
};

type Props = {
  stats: Stats;
  tournament: TournamentOverview | null;
};

function formatDate(dateString?: string | null) {
  if (!dateString) return "TBD";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "TBD";
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function AdminDashboardClient({ stats, tournament }: Props) {
  const recreationalStatus =
    stats.recreationalTeams >= stats.maxTeams
      ? "Full"
      : stats.recreationalTeams >= 2
        ? "Ready"
        : "Needs teams";

  const competitiveStatus =
    stats.competitiveTeams >= stats.maxTeams
      ? "Full"
      : stats.competitiveTeams >= 2
        ? "Ready"
        : "Needs teams";

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <Typography.Title level={2} style={{ marginBottom: 4 }}>
          Admin Dashboard
        </Typography.Title>
        <Typography.Text type="secondary">
          Overview of registration health and tournament readiness.
        </Typography.Text>
      </div>

      <Card style={{ borderRadius: 16 }}>
        <Space direction="vertical" size={8}>
          <Typography.Title level={4} style={{ marginBottom: 0 }}>
            Tournament Overview
          </Typography.Title>
          <Row gutter={[24, 16]}>
            <Col xs={24} md={6}>
              <Typography.Text type="secondary">Name</Typography.Text>
              <div>{tournament?.name ?? "Pickleball for Patriots"}</div>
            </Col>
            <Col xs={24} md={6}>
              <Typography.Text type="secondary">Location</Typography.Text>
              <div>{tournament?.location ?? "TBD"}</div>
            </Col>
            <Col xs={24} md={6}>
              <Typography.Text type="secondary">Event Date</Typography.Text>
              <div>{formatDate(tournament?.event_date)}</div>
            </Col>
            <Col xs={24} md={6}>
              <Typography.Text type="secondary">Status</Typography.Text>
              <div>
                <Tag color="blue">{tournament?.status ?? "Registration"}</Tag>
              </div>
            </Col>
          </Row>
        </Space>
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={6}>
          <Card>
            <Typography.Text type="secondary">Total Teams</Typography.Text>
            <Typography.Title level={3} style={{ marginBottom: 0 }}>
              {stats.totalTeams}
            </Typography.Title>
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card>
            <Typography.Text type="secondary">Active Teams</Typography.Text>
            <Typography.Title level={3} style={{ marginBottom: 0 }}>
              {stats.activeTeams}
            </Typography.Title>
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card>
            <Typography.Text type="secondary">Withdrawn</Typography.Text>
            <Typography.Title level={3} style={{ marginBottom: 0 }}>
              {stats.withdrawnTeams}
            </Typography.Title>
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card>
            <Typography.Text type="secondary">Total Players</Typography.Text>
            <Typography.Title level={3} style={{ marginBottom: 0 }}>
              {stats.totalPlayers}
            </Typography.Title>
          </Card>
        </Col>
      </Row>

      <Card style={{ borderRadius: 16 }}>
        <Space direction="vertical" size={12} className="w-full">
          <Typography.Title level={4} style={{ marginBottom: 0 }}>
            Registration Health
          </Typography.Title>
          <Row gutter={[16, 16]}>
            <Col xs={24} md={12}>
              <Card>
                <Space direction="vertical" size={6}>
                  <Typography.Text strong>Recreational</Typography.Text>
                  <Typography.Text type="secondary">
                    {stats.recreationalTeams} / {stats.maxTeams} teams
                  </Typography.Text>
                  <Badge
                    status={
                      recreationalStatus === "Full"
                        ? "success"
                        : recreationalStatus === "Ready"
                          ? "processing"
                          : "warning"
                    }
                    text={recreationalStatus}
                  />
                </Space>
              </Card>
            </Col>
            <Col xs={24} md={12}>
              <Card>
                <Space direction="vertical" size={6}>
                  <Typography.Text strong>Competitive</Typography.Text>
                  <Typography.Text type="secondary">
                    {stats.competitiveTeams} / {stats.maxTeams} teams
                  </Typography.Text>
                  <Badge
                    status={
                      competitiveStatus === "Full"
                        ? "success"
                        : competitiveStatus === "Ready"
                          ? "processing"
                          : "warning"
                    }
                    text={competitiveStatus}
                  />
                </Space>
              </Card>
            </Col>
          </Row>
        </Space>
      </Card>

      <Card style={{ borderRadius: 16 }}>
        <Space direction="vertical" size={12} className="w-full">
          <Typography.Title level={4} style={{ marginBottom: 0 }}>
            Quick Actions
          </Typography.Title>
          <Space wrap>
            <Link href="/admin/teams">
              <Button type="primary">Manage Teams</Button>
            </Link>
            <Link href="/admin/brackets">
              <Button>Generate Brackets</Button>
            </Link>
            <Link href="/admin/scoring">
              <Button>Enter Scores</Button>
            </Link>
            <Link href="/admin/overrides">
              <Button>Admin Overrides</Button>
            </Link>
          </Space>
        </Space>
      </Card>

      <Card style={{ borderRadius: 16 }}>
        <Space direction="vertical" size={10}>
          <Typography.Title level={4} style={{ marginBottom: 0 }}>
            Operational Alerts
          </Typography.Title>
          <Space direction="vertical" size={4}>
            {recreationalStatus === "Ready" && (
              <Typography.Text>Recreational bracket is ready for generation.</Typography.Text>
            )}
            {competitiveStatus === "Ready" && (
              <Typography.Text>Competitive bracket is ready for generation.</Typography.Text>
            )}
            {stats.recreationalTeams < 2 && (
              <Typography.Text type="secondary">
                Recreational bracket needs more teams to generate a bracket.
              </Typography.Text>
            )}
            {stats.competitiveTeams < 2 && (
              <Typography.Text type="secondary">
                Competitive bracket needs more teams to generate a bracket.
              </Typography.Text>
            )}
            {stats.withdrawnTeams > 0 && (
              <Typography.Text type="secondary">
                {stats.withdrawnTeams} withdrawn team(s) may affect seeding.
              </Typography.Text>
            )}
            {stats.withdrawnTeams === 0 &&
              stats.recreationalTeams >= 2 &&
              stats.competitiveTeams >= 2 && (
                <Typography.Text type="secondary">
                  No operational alerts right now.
                </Typography.Text>
              )}
          </Space>
        </Space>
      </Card>
    </div>
  );
}
