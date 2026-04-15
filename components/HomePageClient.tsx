"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowDownOutlined } from "@ant-design/icons";
import { Badge, Button, Card, Col, Row, Space, Tag, Typography } from "antd";
import LandingHeader from "@/components/LandingHeader";
import ImageCarousel from "@/components/ImageCarousel";
import PurposeSection from "@/components/PurposeSection";
import FAQSection from "@/components/FAQSection";
import ContactSection from "@/components/ContactSection";

const EVENT_DATE = new Date(2026, 3, 18, 9, 0, 0);

type BracketType = "recreational" | "competitive";

type BracketAvailability = {
  type: BracketType;
  registeredTeams: number;
  spotsLeft: number;
};

type Props = {
  bracketAvailability: BracketAvailability[];
};

function getCountdownParts() {
  const diffMs = EVENT_DATE.getTime() - Date.now();
  if (diffMs <= 0) {
    return { days: 0 };
  }

  const totalMinutes = Math.floor(diffMs / (1000 * 60));
  const days = Math.floor(totalMinutes / (60 * 24));

  return { days };
}

function getAvailabilityTone(spotsLeft: number) {
  if (spotsLeft <= 0) {
    return {
      badgeStatus: "default" as const,
      tagColor: "default",
      message: "Full",
    };
  }

  if (spotsLeft <= 3) {
    return {
      badgeStatus: "error" as const,
      tagColor: "red",
      message: `Last ${spotsLeft} spot${spotsLeft === 1 ? "" : "s"}`,
    };
  }

  if (spotsLeft <= 7) {
    return {
      badgeStatus: "warning" as const,
      tagColor: "gold",
      message: `Only ${spotsLeft} spots left`,
    };
  }

  return {
    badgeStatus: "processing" as const,
    tagColor: "blue",
    message: `${spotsLeft} spots left`,
  };
}

function BracketCard({
  type,
  registeredTeams,
  spotsLeft,
}: BracketAvailability) {
  const isRecreational = type === "recreational";
  const label = isRecreational ? "Recreational Bracket" : "Competitive Bracket";
  const buttonType = isRecreational ? "primary" : "default";
  const tone = getAvailabilityTone(spotsLeft);

  return (
    <Card
      style={{ borderRadius: 20 }}
      styles={{ body: { padding: 20 } }}
      className="w-full max-w-sm border border-slate-200 shadow-sm"
    >
      <Space direction="vertical" size={14} className="w-full">
        <Space align="center" className="justify-between w-full">
          <Typography.Title level={4} style={{ margin: 0 }}>
            {label}
          </Typography.Title>
          <Tag color={tone.tagColor} style={{ marginInlineEnd: 0 }}>
            {tone.message}
          </Tag>
        </Space>

        <Typography.Text type="secondary">
          {registeredTeams} / 32 teams registered
        </Typography.Text>

        <Badge
          status={tone.badgeStatus}
          text={
            spotsLeft > 0
              ? "First-come, first-served. Payment is required during signup."
              : "Registration is currently closed for this bracket."
          }
        />

        {spotsLeft > 0 ? (
          <Link href={`/signup/${type}`}>
            <Button type={buttonType} size="large" block>
              Sign Up
            </Button>
          </Link>
        ) : (
          <Button size="large" block disabled>
            Full
          </Button>
        )}
      </Space>
    </Card>
  );
}

export function HomePageClient({ bracketAvailability }: Props) {
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

        <div className="w-full max-w-7xl mx-auto px-0 sm:px-6 md:px-10 flex-1 flex items-center">
          <Row
            gutter={[{ xs: 0, sm: 24, lg: 40 }, 40]}
            align="middle"
            className="w-full"
          >
            <Col xs={24} lg={12}>
              <div className="w-full max-w-md sm:max-w-xl mx-auto px-4 sm:px-0">
                <Space
                  direction="vertical"
                  size={20}
                  className="text-center sm:text-left sm:items-start items-center"
                >
                  <Typography.Text type="secondary" strong className="block">
                    The Aggie Club of Engineers Presents
                  </Typography.Text>
                  <Typography.Title level={1} style={{ margin: 0 }}>
                    Pickleball for Patriots
                  </Typography.Title>
                  <Typography.Paragraph
                    type="secondary"
                    style={{ fontSize: 18, marginBottom: 0 }}
                  >
                    <span className="inline-flex items-center gap-2 justify-center sm:justify-start">
                      <span className="countdown font-mono text-2xl">
                        <span data-value={countdown ? countdown.days : ""} />
                      </span>
                      Days Until Event
                    </span>
                  </Typography.Paragraph>
                  <Typography.Text type="secondary" className="block">
                    Event Date: April 18, 2026
                  </Typography.Text>

                  {/* <Card
                    style={{ borderRadius: 20 }}
                    styles={{ body: { padding: 18 } }}
                    className="w-full border-0 bg-slate-900 text-white shadow-lg"
                  >
                    <Space direction="vertical" size={4}>
                      <Typography.Text
                        strong
                        style={{ color: "rgba(255,255,255,0.92)" }}
                      >
                        Registration is first-come, first-served.
                      </Typography.Text>
                      <Typography.Text style={{ color: "rgba(255,255,255,0.72)" }}>
                        Buy your ticket, then claim your bracket before the
                        remaining spots are gone.
                      </Typography.Text>
                    </Space>
                  </Card> */}

                  <Row gutter={[16, 16]} className="w-full">
                    {bracketAvailability.map((bracket) => (
                      <Col xs={24} md={12} key={bracket.type}>
                        <BracketCard {...bracket} />
                      </Col>
                    ))}
                  </Row>
                </Space>
              </div>
            </Col>

            <Col xs={24} lg={12}>
              <div className="w-full max-w-md sm:max-w-lg mx-auto px-4 sm:px-0">
                <ImageCarousel />
              </div>
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
