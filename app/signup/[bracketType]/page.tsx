"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { Alert, Button, Card, Form, Input, Typography } from "antd";
import { registerTeam } from "./actions";

export default function SignupPage() {
  const { bracketType } = useParams();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  if (bracketType !== "recreational" && bracketType !== "competitive") {
    return <Typography.Text>Invalid bracket.</Typography.Text>;
  }

  const onFinish = async (values: any) => {
    try {
      setError(null);
      setLoading(true);
      await registerTeam(bracketType, values);
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <Card className="max-w-md w-full">
          <Typography.Title level={3}>
            Registration Complete 🎉
          </Typography.Title>
          <Typography.Paragraph>
            Your team has been successfully registered for the{" "}
            <strong>{bracketType}</strong> bracket.
          </Typography.Paragraph>
          <Typography.Paragraph type="secondary">
            We’ll contact you via email with tournament details.
          </Typography.Paragraph>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <Card className="max-w-md w-full">
        <Typography.Title level={3}>
          {bracketType === "recreational"
            ? "Recreational Bracket Signup"
            : "Competitive Bracket Signup"}
        </Typography.Title>

        <Typography.Paragraph type="secondary">
          Please provide accurate contact information. We’ll use this to share
          tournament details.
        </Typography.Paragraph>

        {error && (
          <Alert
            type="error"
            message={error}
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        <Form layout="vertical" onFinish={onFinish}>
          <Form.Item
            label="Team Name"
            name="teamName"
            rules={[{ required: true }]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            label="Team Contact Email"
            name="contactEmail"
            rules={[
              {
                required: true,
                type: "email",
                message: "Enter a valid email.",
              },
            ]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            label="Player 1 Name"
            name="player1Name"
            rules={[{ required: true }]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            label="Player 1 Email"
            name="player1Email"
            rules={[
              {
                required: true,
                type: "email",
                message: "Enter a valid email.",
              },
            ]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            label="Player 2 Name"
            name="player2Name"
            rules={[{ required: true }]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            label="Player 2 Email"
            name="player2Email"
            rules={[
              {
                required: true,
                type: "email",
                message: "Enter a valid email.",
              },
            ]}
          >
            <Input />
          </Form.Item>

          <Button type="primary" htmlType="submit" block loading={loading}>
            Register Team
          </Button>
        </Form>
      </Card>
    </div>
  );
}
