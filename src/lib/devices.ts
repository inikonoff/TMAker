import type { Device, DevicePreset, Project, Screen } from "./model";

export type DeviceInfo = { id: DevicePreset; label: string; w: number; h: number; safeTop: number };

export const DEVICE_PRESETS: Record<DevicePreset, DeviceInfo> = {
  phone: { id: "phone", label: "Телефон", w: 390, h: 844, safeTop: 44 },
  // Mini App в Telegram: узкий экран ~1:2, сверху шапка клиента.
  telegram: { id: "telegram", label: "Telegram", w: 390, h: 780, safeTop: 0 },
  tablet: { id: "tablet", label: "Планшет", w: 820, h: 1180, safeTop: 24 },
};

export const MIN_DEVICE = 120;
export const MAX_DEVICE = 4000;

export function deviceSize(d: Device): { w: number; h: number } {
  if (typeof d === "string") {
    const p = DEVICE_PRESETS[d];
    return { w: p.w, h: p.h };
  }
  return { w: d.w, h: d.h };
}

export function screenDevice(project: Pick<Project, "device">, screen: Pick<Screen, "device">): Device {
  return screen.device ?? project.device;
}

export function screenSize(project: Pick<Project, "device">, screen: Pick<Screen, "device">) {
  return deviceSize(screenDevice(project, screen));
}

export function deviceLabel(d: Device): string {
  if (typeof d === "string") return DEVICE_PRESETS[d].label;
  return `${d.w}×${d.h}`;
}

export function isDevicePreset(v: unknown): v is DevicePreset {
  return typeof v === "string" && v in DEVICE_PRESETS;
}
