"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Fragment, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Col,
  Divider,
  Form,
  Input,
  Row,
  Space,
  Tag,
  Typography,
} from "antd";
import {
  CheckCircleTwoTone,
  MailOutlined,
  TeamOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { registerTeam } from "./actions";

type BracketType = "recreational" | "competitive";

type SignupFormValues = {
  teamName: string;
  contactEmail: string;
  player1Name: string;
  player1Email: string;
  player2Name: string;
  player2Email: string;
};

const REQUIRED_TEXT = "This field is required.";
const URL_PATTERN = /(https?:\/\/[^\s]+)/g;

function renderErrorMessage(message: string) {
  const parts = message.split(URL_PATTERN);

  return parts.map((part, index) => {
    if (!part) return null;

    if (part.startsWith("http://") || part.startsWith("https://")) {
      return (
        <a
          key={`${part}-${index}`}
          href={part}
          target="_blank"
          rel="noreferrer"
        >
          {part}
        </a>
      );
    }

    return <Fragment key={`${part}-${index}`}>{part}</Fragment>;
  });
}

export default function SignupPage() {
  const params = useParams<{ bracketType: string }>();
  const bracketType = params?.bracketType;
  const [form] = Form.useForm<SignupFormValues>();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const errorMessage = useMemo(
    () => (error ? renderErrorMessage(error) : null),
    [error],
  );

  if (bracketType !== "recreational" && bracketType !== "competitive") {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <Card className="max-w-lg w-full" style={{ borderRadius: 16 }}>
          <Typography.Title level={4}>Invalid Bracket</Typography.Title>
          <Typography.Paragraph type="secondary">
            This signup link is invalid. Please return to the homepage and
            choose a valid bracket.
          </Typography.Paragraph>
          <Link href="/">
            <Button type="primary">Back to Home</Button>
          </Link>
        </Card>
      </div>
    );
  }

  const bracketLabel =
    bracketType === "recreational"
      ? "Recreational Bracket"
      : "Competitive Bracket";

  const onFinish = async (values: SignupFormValues) => {
    setError(null);
    setLoading(true);
    try {
      const result = await registerTeam(bracketType as BracketType, values);
      if ("error" in result) {
        setError(result.error);
      } else {
        setSuccess(true);
        form.resetFields();
      }
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 py-10">
        <Card className="max-w-2xl w-full" style={{ borderRadius: 16 }}>
          <Space direction="vertical" size={12} className="w-full">
            <CheckCircleTwoTone
              twoToneColor="#52c41a"
              style={{ fontSize: 28 }}
            />
            <Typography.Title level={3} style={{ margin: 0 }}>
              You are registered
            </Typography.Title>
            <Typography.Paragraph style={{ marginBottom: 0 }}>
              Your team has been successfully registered for the{" "}
              <strong>{bracketLabel}</strong>.
            </Typography.Paragraph>
            <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
              We will send next steps and tournament updates to your contact
              email.
            </Typography.Paragraph>
            <Space wrap>
              <Button onClick={() => setSuccess(false)}>
                Register Another Team
              </Button>
              <Link href="/">
                <Button type="primary">Back to Home</Button>
              </Link>
            </Space>
          </Space>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-10">
      <Card className="max-w-2xl w-full" style={{ borderRadius: 16 }}>
        <Space direction="vertical" size={8} className="w-full">
          <Tag color={bracketType === "recreational" ? "blue" : "volcano"}>
            {bracketLabel}
          </Tag>
          <Typography.Title level={3} style={{ margin: 0 }}>
            Team Registration
          </Typography.Title>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            Enter team and player information. You can reuse a player email for
            the team email.
          </Typography.Paragraph>

          <Typography.Text type="secondary">
            Note that each bracket is capped at 32 teams and registration is
            first-come, first-serve.
          </Typography.Text>
        </Space>

        <Divider />

        {error && (
          <Alert
            type="error"
            message={errorMessage}
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        <Form<SignupFormValues>
          form={form}
          layout="vertical"
          onFinish={onFinish}
          scrollToFirstError
          requiredMark={false}
        >
          <Typography.Title level={5}>Team Details</Typography.Title>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                label="Team Name"
                name="teamName"
                rules={[
                  { required: true, message: REQUIRED_TEXT },
                  {
                    min: 2,
                    message: "Team name should be at least 2 characters.",
                  },
                  { whitespace: true, message: "Team name cannot be blank." },
                ]}
              >
                <Input
                  prefix={<TeamOutlined />}
                  placeholder="Example: ACE Studs"
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                label="Team Contact Email"
                name="contactEmail"
                rules={[
                  { required: true, message: REQUIRED_TEXT },
                  { type: "email", message: "Enter a valid email." },
                ]}
              >
                <Input
                  prefix={<MailOutlined />}
                  placeholder="reveille@tamu.edu"
                  autoComplete="email"
                />
              </Form.Item>
            </Col>
          </Row>

          <Divider style={{ margin: "8px 0 20px" }} />
          <Typography.Title level={5}>Player Details</Typography.Title>

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                label="Player 1 Name"
                name="player1Name"
                rules={[
                  { required: true, message: REQUIRED_TEXT },
                  { whitespace: true, message: "Player name cannot be blank." },
                ]}
              >
                <Input prefix={<UserOutlined />} placeholder="Ridge Robinson" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                label="Player 1 Email"
                name="player1Email"
                rules={[
                  { required: true, message: REQUIRED_TEXT },
                  { type: "email", message: "Enter a valid email." },
                ]}
              >
                <Input
                  prefix={<MailOutlined />}
                  placeholder="reveille@tamu.edu"
                  autoComplete="email"
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                label="Player 2 Name"
                name="player2Name"
                rules={[
                  { required: true, message: REQUIRED_TEXT },
                  { whitespace: true, message: "Player name cannot be blank." },
                ]}
              >
                <Input prefix={<UserOutlined />} placeholder="Taylor Six" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                label="Player 2 Email"
                name="player2Email"
                rules={[
                  { required: true, message: REQUIRED_TEXT },
                  { type: "email", message: "Enter a valid email." },
                ]}
              >
                <Input
                  prefix={<MailOutlined />}
                  placeholder="reveille@tamu.edu"
                  autoComplete="email"
                />
              </Form.Item>
            </Col>
          </Row>

          <Space direction="vertical" size={12} className="w-full">
            <Button
              type="primary"
              htmlType="submit"
              block
              loading={loading}
              size="large"
            >
              Register Team
            </Button>
            <Typography.Text type="secondary">
              ACE can update team details later if you need corrections.
            </Typography.Text>
          </Space>
        </Form>
      </Card>
    </div>
  );
}
