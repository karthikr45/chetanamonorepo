import { FeedPostDetailContent } from "./FeedPostDetailContent";

export default async function FeedPostDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <FeedPostDetailContent id={id} />;
}
