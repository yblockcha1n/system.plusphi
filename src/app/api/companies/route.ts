import type { NextRequest } from "next/server";
import { readJson, withSession } from "@/lib/api";
import { saveCompany } from "@/features/companies/service";

export async function POST(request: NextRequest) {
  return withSession(request, async (session) => saveCompany(session, await readJson(request)));
}
