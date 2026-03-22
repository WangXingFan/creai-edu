const TIME_FORMATTER = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

export function formatBeijingTime(value: string | Date | null | undefined): string {
  if (!value) {
    return "-";
  }

  let date: Date;
  if (value instanceof Date) {
    date = value;
  } else {
    // Backend stores UTC but returns ISO strings without 'Z' suffix.
    // Append 'Z' so JS parses it as UTC, then formatter converts to Asia/Shanghai.
    const raw = value.endsWith("Z") || value.includes("+") ? value : value + "Z";
    date = new Date(raw);
  }

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return TIME_FORMATTER.format(date);
}
