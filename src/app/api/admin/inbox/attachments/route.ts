import { chatUpload } from "@/lib/agent/chat-upload-http";
export const runtime = "nodejs";
export const maxDuration = 60;
export const POST = (request: Request) => chatUpload(request, true);
