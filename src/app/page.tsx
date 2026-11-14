"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useReport } from "@/lib/reportStore";

export default function HomePage() {
  const router = useRouter();
  const [report] = useReport();

  useEffect(() => {
    if (report) {
      router.replace("/dashboard");
    } else {
      router.replace("/connect");
    }
  }, [report, router]);

  return null;
}
