import EventSectionPage from "@/components/EventSectionPage";

export default async function GroupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <EventSectionPage id={id} section="group" />;
}
