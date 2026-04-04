import { listReviewers } from "@/lib/reviewers";

export async function GET() {
  const reviewers = await listReviewers();
  return Response.json(reviewers);
}
