"use client";

import { useState } from "react";
import { Button, Form, InputNumber, Space } from "antd";
import { reportMatchResult } from "@/app/admin/scoring/actions";

export default function ScoreForm({
  matchId,
  teamAName,
  teamBName,
}: {
  matchId: string;
  teamAName: string;
  teamBName: string;
}) {
  const [loading, setLoading] = useState(false);

  const onFinish = async (values: { scoreA: number; scoreB: number }) => {
    try {
      setLoading(true);
      await reportMatchResult({
        matchId,
        scoreA: values.scoreA,
        scoreB: values.scoreB,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Form layout="inline" onFinish={onFinish}>
      <Space wrap>
        <Form.Item
          name="scoreA"
          label={teamAName}
          rules={[{ required: true, message: "Required" }]}
        >
          <InputNumber min={0} />
        </Form.Item>

        <Form.Item
          name="scoreB"
          label={teamBName}
          rules={[{ required: true, message: "Required" }]}
        >
          <InputNumber min={0} />
        </Form.Item>

        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading}>
            Save Result
          </Button>
        </Form.Item>
      </Space>
    </Form>
  );
}
