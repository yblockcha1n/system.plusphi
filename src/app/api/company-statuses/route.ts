import type { NextRequest } from "next/server";
import { readJson, withSession } from "@/lib/api";
import { saveCompanyStatus } from "@/features/company-statuses/service";

export async function POST(request: NextRequest) {
  return withSession(request, async (session) => saveCompanyStatus(session, await readJson(request)));
}
