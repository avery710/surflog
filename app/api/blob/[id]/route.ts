import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { readBlob } from "@/lib/blob";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const blob = await readBlob(id);
  if (!blob || blob.ownerId !== session.user.id) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(blob.bytes), {
    headers: {
      "Content-Type": blob.mimeType,
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
