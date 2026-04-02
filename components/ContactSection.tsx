import Image from "next/image";
import { Button, Card, Col, Row, Space, Tag, Typography } from "antd";

export default function ContactSection() {
  return (
    <section className="py-10 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto">
        <Card style={{ borderRadius: 16 }}>
          <Space direction="vertical" size={12} className="w-full">
            <Row gutter={[8, 16]} align="middle">
              <Col xs={24} sm={8} className="flex justify-center sm:justify-start">
                <Image
                  src="/assets/RidgeRobinson.jpeg"
                  alt="Ridge Robinson"
                  width={220}
                  height={220}
                  className="mx-auto sm:mx-0 rounded-2xl object-cover shadow-md"
                />
              </Col>
              <Col xs={24} sm={16}>
                <Space direction="vertical" size={10}>
                  <Tag color="green">Contact</Tag>
                  <Typography.Title level={2} style={{ margin: 0 }}>
                    Here to help!
                  </Typography.Title>
                  <Typography.Paragraph style={{ marginBottom: 0 }}>
                    Reach out to <strong>Ridge Robinson</strong> for
                    registration, sponsorship, or volunteer opportunities.
                  </Typography.Paragraph>
                  <Button
                    type="default"
                    size="middle"
                    href="mailto:ridgerobinson@tamu.edu"
                  >
                    Email Ridge
                  </Button>
                </Space>
              </Col>
            </Row>
          </Space>
        </Card>
      </div>
    </section>
  );
}
