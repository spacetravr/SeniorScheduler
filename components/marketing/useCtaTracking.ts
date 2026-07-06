"use client";

import { useCallback, useEffect, useRef } from "react";
import type {
  CtaEventInput,
  CtaEventType,
  Utm,
  WaitlistInput,
} from "@/lib/contracts/cta";

const SESSION_KEY = "vs_session_uuid";
const UTM_KEY = "vs_utm";
const VIEW_FLAG_KEY = "vs_view_sent";

/** session_uuid 를 localStorage 에 유지 (없으면 생성). */
function getSessionUuid(): string {
  if (typeof window === "undefined") return "";
  let id = window.localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    window.localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

/** 첫 진입 시 URL 쿼리의 utm 3종을 파싱해 sessionStorage 에 유지. */
function getUtm(): Utm {
  if (typeof window === "undefined") return {};
  const cached = window.sessionStorage.getItem(UTM_KEY);
  if (cached) {
    try {
      return JSON.parse(cached) as Utm;
    } catch {
      /* ignore */
    }
  }
  const params = new URLSearchParams(window.location.search);
  const utm: Utm = {
    utm_source: params.get("utm_source") ?? null,
    utm_medium: params.get("utm_medium") ?? null,
    utm_campaign: params.get("utm_campaign") ?? null,
  };
  window.sessionStorage.setItem(UTM_KEY, JSON.stringify(utm));
  return utm;
}

/** fetch 실패는 조용히 무시 — UX 차단 금지. */
async function postJson(url: string, body: unknown): Promise<Response | null> {
  try {
    return await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    return null;
  }
}

export function useCtaTracking() {
  const readyRef = useRef(false);

  useEffect(() => {
    // 클라이언트 초기화 (session_uuid + utm 확정) 및 VIEW 1회 전송.
    getSessionUuid();
    getUtm();
    readyRef.current = true;

    if (window.sessionStorage.getItem(VIEW_FLAG_KEY)) return;
    window.sessionStorage.setItem(VIEW_FLAG_KEY, "1");
    void sendEvent("VIEW");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sendEvent = useCallback(async (type: CtaEventType) => {
    const body: CtaEventInput = {
      type,
      session_uuid: getSessionUuid(),
      ...getUtm(),
    };
    await postJson("/api/cta", body);
  }, []);

  const submitWaitlist = useCallback(async (email: string): Promise<boolean> => {
    const body: WaitlistInput = {
      email,
      session_uuid: getSessionUuid(),
      ...getUtm(),
    };
    // 대기자 제출과 함께 전환 이벤트도 기록.
    void sendEvent("WAITLIST_SUBMIT");
    const res = await postJson("/api/waitlist", body);
    return res?.status === 201;
  }, [sendEvent]);

  return { sendEvent, submitWaitlist };
}
