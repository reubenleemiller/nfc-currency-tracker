import { currentTeacher } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function Home() { redirect((await currentTeacher()) ? "/app" : "/login"); }
