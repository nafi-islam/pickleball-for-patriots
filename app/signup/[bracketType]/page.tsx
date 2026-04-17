import { SignupClient } from "./SignupClient";

type PageProps = {
  params: Promise<{ bracketType: string }>;
  searchParams?: Promise<{ enforcePayment?: string }>;
};

export default async function SignupPage({ params, searchParams }: PageProps) {
  const { bracketType } = await params;
  const query = searchParams ? await searchParams : {};
  const ticketUrl = process.env.PARTICIPANT_TICKET_URL ?? null;
  const enforcePayment = query.enforcePayment !== "false";

  return (
    <SignupClient
      bracketType={bracketType}
      ticketUrl={ticketUrl}
      enforcePayment={enforcePayment}
    />
  );
}
