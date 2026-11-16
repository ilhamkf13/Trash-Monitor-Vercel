import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase environment variables belum diatur.");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

function validDeviceToken(received: string) {
  const expected = process.env.DEVICE_TOKEN || "";
  if (!expected || !received) return false;
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET() {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("trash_readings")
      .select("id, created_at, distance_cm, fill_height_cm, capacity_percent, status, latitude, longitude, satellites, gps_valid")
      .order("created_at", { ascending: false })
      .limit(60);

    if (error) throw error;
    return NextResponse.json({ readings: data ?? [] }, {
      headers: { "Cache-Control": "no-store, max-age=0" }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!validDeviceToken(request.headers.get("x-device-token") || "")) {
    return NextResponse.json({ error: "Unauthorized device" }, { status: 401 });
  }

  try {
    const body = await request.json();

    const distance = Number(body.distance_cm);
    const fillHeight = Number(body.fill_height_cm);
    const capacity = Number(body.capacity_percent);
    const status = String(body.status || "");
    const gpsValid = body.gps_valid === true;
    const allowedStatuses = ["BELUM PENUH", "HAMPIR PENUH", "PENUH"];

    if (
      !Number.isFinite(distance) || distance < 0 || distance > 57 ||
      !Number.isFinite(fillHeight) || fillHeight < 0 || fillHeight > 57 ||
      !Number.isFinite(capacity) || capacity < 0 || capacity > 100 ||
      !allowedStatuses.includes(status)
    ) {
      return NextResponse.json({ error: "Payload sensor tidak valid" }, { status: 400 });
    }

    let latitude: number | null = null;
    let longitude: number | null = null;

    if (gpsValid) {
      latitude = Number(body.latitude);
      longitude = Number(body.longitude);
      if (
        !Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
        !Number.isFinite(longitude) || longitude < -180 || longitude > 180
      ) {
        return NextResponse.json({ error: "Koordinat GPS tidak valid" }, { status: 400 });
      }
    }

    const satellites = body.satellites == null ? null : Number(body.satellites);
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("trash_readings")
      .insert({
        distance_cm: distance,
        fill_height_cm: fillHeight,
        capacity_percent: capacity,
        status,
        latitude,
        longitude,
        satellites: Number.isFinite(satellites) ? satellites : null,
        gps_valid: gpsValid
      })
      .select("id, created_at")
      .single();

    if (error) throw error;
    return NextResponse.json({ ok: true, saved: data }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
