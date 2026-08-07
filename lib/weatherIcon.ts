import {
  Sun,
  CloudSun,
  Cloud,
  CloudFog,
  CloudDrizzle,
  CloudRain,
  CloudSnow,
  Snowflake,
  CloudLightning,
  Thermometer,
  type LucideIcon,
} from "lucide-react";

/* Single source for WMO weather-code → label + icon.
   Both Weather.tsx and the Desk weather widget read this — they used to keep
   two separate emoji maps that had already drifted apart. */

const WMO_CODES: Record<number, { label: string; icon: LucideIcon }> = {
  0: { label: "Clear", icon: Sun },
  1: { label: "Mostly clear", icon: CloudSun },
  2: { label: "Partly cloudy", icon: CloudSun },
  3: { label: "Overcast", icon: Cloud },
  45: { label: "Foggy", icon: CloudFog },
  48: { label: "Icy fog", icon: CloudFog },
  51: { label: "Light drizzle", icon: CloudDrizzle },
  53: { label: "Drizzle", icon: CloudDrizzle },
  55: { label: "Heavy drizzle", icon: CloudRain },
  61: { label: "Light rain", icon: CloudRain },
  63: { label: "Rain", icon: CloudRain },
  65: { label: "Heavy rain", icon: CloudRain },
  71: { label: "Light snow", icon: CloudSnow },
  73: { label: "Snow", icon: Snowflake },
  75: { label: "Heavy snow", icon: Snowflake },
  80: { label: "Showers", icon: CloudDrizzle },
  81: { label: "Showers", icon: CloudRain },
  82: { label: "Heavy showers", icon: CloudLightning },
  95: { label: "Thunderstorm", icon: CloudLightning },
  99: { label: "Thunderstorm", icon: CloudLightning },
};

export function getWeather(code: number): { label: string; icon: LucideIcon } {
  return WMO_CODES[code] ?? { label: "Unknown", icon: Thermometer };
}
