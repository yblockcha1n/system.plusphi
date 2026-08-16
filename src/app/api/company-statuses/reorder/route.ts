import type { NextRequest } from "next/server";
import { readJson, withSession } from "@/lib/api";
import { reorderCompanyStatuses } from "@/features/company-statuses/service";

export async function POST(request: NextRequest) {
  return withSession(request, async () => reorderCompanyStatuses(await readJson(request)));
}
