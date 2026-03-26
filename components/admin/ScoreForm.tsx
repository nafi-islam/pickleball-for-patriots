"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Form, InputNumber, Space, message } from "antd";
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
  const [form] = Form.useForm();
  const [messageApi, contextHolder] = message.useMessage();
  const router = useRouter();

  const onFinish = async (values: { scoreA: number; scoreB: number }) => {
    try {
      setLoading(true);
      await reportMatchResult({
        matchId,
        scoreA: values.scoreA,
        scoreB: values.scoreB,
      });
      messageApi.success("Score saved.");
      form.resetFields();
      router.refresh();
    } catch (error) {
      messageApi.error(
        error instanceof Error ? error.message : "Failed to save score.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {contextHolder}
      <Form form={form} layout="inline" onFinish={onFinish}>
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
    </>
  );
}
