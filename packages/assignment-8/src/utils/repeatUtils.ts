import { Event, RepeatType } from "../types";
import { findOverlappingEvents } from "../utils/eventOverlap";

/**
 * 반복 일정을 생성하여 반환하는 함수
 */
export function generateRepeatingEvents(event: Event): Event[] {
  if (event.repeat.type === "none") {
    return [event];
  }

  const events: Event[] = [];
  let currentDate = new Date(event.date);
  const endDate = event.repeat.endDate ? new Date(event.repeat.endDate) : null;

  // 반복 기준이 되는 스케줄 추가
  events.push({ ...event });

  let count = 0;
  const maxRepeats = 4; // 최대 반복 횟수 설정

  while (count < maxRepeats) {
    switch (event.repeat.type) {
      case "daily":
        currentDate.setDate(currentDate.getDate() + event.repeat.interval);
        break;
      case "weekly":
        currentDate.setDate(currentDate.getDate() + event.repeat.interval * 7);
        break;
      case "monthly":
        currentDate.setMonth(currentDate.getMonth() + event.repeat.interval);
        break;
      case "yearly":
        currentDate.setFullYear(
          currentDate.getFullYear() + event.repeat.interval
        );
        break;
    }

    // endDate가 있고 currentDate가 endDate를 초과하면 반복 중단
    if (endDate && currentDate > endDate) {
      break;
    }

    const newEvent: Event = {
      ...event,
      date: currentDate.toISOString().split("T")[0],
    };
    events.push(newEvent);

    count++;
  }

  return events;
}

/**
 * 반복 일정 표시를 위한 필터 함수
 */
export function filterRepeatingEvents(
  events: Event[],
  view: "week" | "month",
  currentDate: Date
): Event[] {
  return events.filter((event) => {
    const eventDate = new Date(event.date);
    if (view === "week") {
      const weekStart = new Date(currentDate);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1); // Monday
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6); // Sunday
      return eventDate >= weekStart && eventDate <= weekEnd;
    } else if (view === "month") {
      const monthStart = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth(),
        1
      );
      const monthEnd = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth() + 1,
        0
      );
      return eventDate >= monthStart && eventDate <= monthEnd;
    }
    return false;
  });
}
