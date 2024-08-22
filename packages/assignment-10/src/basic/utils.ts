export const fill2 = (n: number) => `0${n}`.substr(-2);

export const parseHnM = (current: number) => {
  const date = new Date(current);
  return `${fill2(date.getHours())}:${fill2(date.getMinutes())}`;
};

const getTimeRange = (value: string): number[] => {
  const [start, end] = value.split("~").map(Number);
  if (end === undefined) return [start];
  return Array(end - start + 1)
    .fill(start)
    .map((v, k) => v + k);
};

export const parseSchedule = (
  schedule: string | null | undefined
): { day: string; range: number[]; room?: string }[] => {
  if (!schedule) return [];

  const schedules = schedule.split("<p>");
  return schedules
    .map((scheduleItem) => {
      const reg = /^([가-힣])(\d+(~\d+)?)(.*)/;
      const match = scheduleItem.match(reg);

      if (!match) return null;

      const [, day, timeRange, , room] = match;
      const range = getTimeRange(timeRange);

      return { day, range, room: room?.replace(/\(|\)/g, "") };
    })
    .filter(Boolean) as { day: string; range: number[]; room?: string }[];
};
