import EventSectionPage from "@/components/EventSectionPage";

export default async function MatchesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EventSectionPage id={id} section="matches" />;
}
