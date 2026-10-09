import { NextResponse, type NextRequest } from "next/server";
import { rateLimited } from "@/lib/rate-limit";
export function middleware(request: NextRequest) { const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown"; if (rateLimited(`card:${forwarded}`)) return new NextResponse("Not found", { status: 404 }); return NextResponse.next(); }
export const config = { matcher: ["/c/:path*", "/s/:path*"] };
