"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowDownOutlined } from "@ant-design/icons";
import { Button, Col, Row, Space, Typography } from "antd";
import LandingHeader from "@/components/LandingHeader";
import ImageCarousel from "@/components/ImageCarousel";
import PurposeSection from "@/components/PurposeSection";
import FAQSection from "@/components/FAQSection";
import ContactSection from "@/components/ContactSection";

const EVENT_DATE = new Date(2026, 3, 18, 9, 0, 0);

function getCountdownParts() {
  const diffMs = EVENT_DATE.getTime() - Date.now();
  if (diffMs <= 0) {
    return { days: 0 };
  }

  const totalMinutes = Math.floor(diffMs / (1000 * 60));
  const days = Math.floor(totalMinutes / (60 * 24));

  return { days };
}

export default function HomePage() {
  const nextSectionRef = useRef<HTMLDivElement>(null);
  const [countdown, setCountdown] = useState<{ days: number } | null>(null);

  useEffect(() => {
    const updateCountdown = () => setCountdown(getCountdownParts());
    const timeoutId = window.setTimeout(updateCountdown, 0);
    const timer = window.setInterval(() => {
      updateCountdown();
    }, 1000);

    return () => {
      window.clearTimeout(timeoutId);
      window.clearInterval(timer);
    };
  }, []);

  const handleScrollToNextSection = () => {
    nextSectionRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  return (
    <main className="bg-linear-to-b from-blue-50 via-white to-white">
      <section className="min-h-screen flex flex-col">
        <LandingHeader />

        <div className="w-full max-w-7xl mx-auto px-6 md:px-10 flex-1 flex items-center">
          <Row gutter={[40, 40]} align="middle" className="w-full">
            <Col xs={24} lg={12}>
              <Space direction="vertical" size={16}>
                <Typography.Text type="secondary" strong>
                  The Aggie Club of Engineers Presents
                </Typography.Text>
                <Typography.Title level={1} style={{ margin: 0 }}>
                  Pickleball for Patriots
                </Typography.Title>
                <Typography.Paragraph
                  type="secondary"
                  style={{ fontSize: 18, marginBottom: 0 }}
                >
                  <span className="inline-flex items-center gap-2">
                    <span className="countdown font-mono text-2xl">
                      <span data-value={countdown ? countdown.days : ""} />
                    </span>
                    Days Until Event
                  </span>
                </Typography.Paragraph>
                <Typography.Text type="secondary">
                  Event Date: April 18, 2026
                </Typography.Text>

                <Space wrap size="middle">
                  <Link href="/signup/recreational">
                    <Button type="primary" size="large">
                      Recreational Bracket
                    </Button>
                  </Link>
                  <Link href="/signup/competitive">
                    <Button size="large">Competitive Bracket</Button>
                  </Link>
                </Space>
              </Space>
            </Col>

            <Col xs={24} lg={12}>
              <ImageCarousel />
            </Col>
          </Row>
        </div>

        <div className="flex justify-center pb-8">
          <Button
            type="text"
            aria-label="Scroll to next section"
            icon={<ArrowDownOutlined />}
            onClick={handleScrollToNextSection}
          />
        </div>
      </section>

      <div ref={nextSectionRef}>
        <PurposeSection />
      </div>

      <div id="faq">
        <FAQSection />
      </div>

      <ContactSection />
    </main>
  );
}
