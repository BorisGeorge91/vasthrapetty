import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const enquirySchema = z.object({
  budget: z.string().max(80).optional().default(""),
  deliveryDate: z.string().max(10).optional().default(""),
  city: z.string().max(1200).optional().default(""),
  pin: z.string().max(20).optional().default(""),
  deliveryLat: z.number().min(-90).max(90).nullable().optional(),
  deliveryLon: z.number().min(-180).max(180).nullable().optional(),
  occasion: z.string().max(120).optional().default(""),
  recipientBrief: z.string().max(2000).optional().default(""),
  selectedProduct: z.string().uuid().optional().or(z.literal("")).default(""),
  addons: z.array(z.string().max(160)).max(20).optional().default([]),
  customNotes: z.string().max(2000).optional().default(""),
  name: z.string().max(160).optional().default(""),
  phone: z.string().max(40).optional().default(""),
  email: z.string().email().max(254).optional().or(z.literal("")).default(""),
  brief: z.string().max(3000).optional().default(""),
  website: z.string().max(0).optional().default(""),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Please submit a valid enquiry." }, { status: 400 });
  }

  const parsed = enquirySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Some enquiry details are invalid. Please review the form and try again.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const payload = parsed.data;
  if (payload.deliveryDate && !/^\d{4}-\d{2}-\d{2}$/.test(payload.deliveryDate)) {
    return NextResponse.json({ error: "Please enter a valid delivery date." }, { status: 400 });
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("submit_enquiry", { p_payload: payload });
    if (error) {
      console.error("Supabase enquiry submission failed:", error.message);
      return NextResponse.json({ error: "We couldn't save your enquiry. Please try again." }, { status: 500 });
    }
    return NextResponse.json({ ok: true, enquiryId: data }, { status: 201 });
  } catch (error) {
    console.error("Enquiry API configuration error:", error);
    return NextResponse.json({ error: "The enquiry service is not configured yet. Please try again later." }, { status: 503 });
  }
}
