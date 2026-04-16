import { SignupClient } from "./SignupClient";

type PageProps = {
  params: Promise<{ bracketType: string }>;
};

export default async function SignupPage({ params }: PageProps) {
  const { bracketType } = await params;
  const ticketUrl = process.env.PARTICIPANT_TICKET_URL ?? null;

  return <SignupClient bracketType={bracketType} ticketUrl={ticketUrl} />;
}
