import { listAssistants } from "@/lib/assistants";

export async function GET() {
  const assistants = await listAssistants();
  return Response.json(assistants);
}
