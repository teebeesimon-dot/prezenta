import EventSectionPage from "@/components/EventSectionPage";

export default async function CardsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <EventSectionPage id={id} section="cards" />;
}
