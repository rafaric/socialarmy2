export type EventCategory = "concert";
export type Region = "asia" | "north_america" | "europe" | "south_america" | "oceania";

export interface BtsEvent {
  id: string;
  title: string;
  venue: string;
  city: string;
  country: string;
  flag: string;
  region: Region;
  dates: string[]; // YYYY-MM-DD
  category: EventCategory;
  isArgentina?: true;
}

// Source: Wikipedia — Arirang World Tour
// https://en.wikipedia.org/wiki/Arirang_World_Tour
export const BTS_EVENTS: BtsEvent[] = [
  // ── Asia ──────────────────────────────────────────────────────────────────
  {
    id: "kor-goyang",
    title: "BTS World Tour: Arirang",
    venue: "Goyang Stadium",
    city: "Goyang",
    country: "Corea del Sur",
    flag: "🇰🇷",
    region: "asia",
    dates: ["2026-04-09", "2026-04-11", "2026-04-12"],
    category: "concert",
  },
  {
    id: "jpn-tokyo",
    title: "BTS World Tour: Arirang",
    venue: "National Olympic Stadium",
    city: "Tokio",
    country: "Japón",
    flag: "🇯🇵",
    region: "asia",
    dates: ["2026-04-17", "2026-04-18"],
    category: "concert",
  },
  {
    id: "twn-kaohsiung",
    title: "BTS World Tour: Arirang",
    venue: "National Stadium",
    city: "Kaohsiung",
    country: "Taiwán",
    flag: "🇹🇼",
    region: "asia",
    dates: ["2026-11-19", "2026-11-21", "2026-11-22"],
    category: "concert",
  },
  {
    id: "tha-bangkok",
    title: "BTS World Tour: Arirang",
    venue: "National Stadium",
    city: "Bangkok",
    country: "Tailandia",
    flag: "🇹🇭",
    region: "asia",
    dates: ["2026-12-03", "2026-12-05", "2026-12-06"],
    category: "concert",
  },
  {
    id: "mys-kualalumpur",
    title: "BTS World Tour: Arirang",
    venue: "Bukit Jalil National Stadium",
    city: "Kuala Lumpur",
    country: "Malasia",
    flag: "🇲🇾",
    region: "asia",
    dates: ["2026-12-12", "2026-12-13", "2026-12-17"],
    category: "concert",
  },
  {
    id: "sgp-singapore",
    title: "BTS World Tour: Arirang",
    venue: "National Stadium",
    city: "Singapur",
    country: "Singapur",
    flag: "🇸🇬",
    region: "asia",
    dates: ["2026-12-19", "2026-12-20", "2026-12-22"],
    category: "concert",
  },
  {
    id: "idn-jakarta",
    title: "BTS World Tour: Arirang",
    venue: "Gelora Bung Karno",
    city: "Yakarta",
    country: "Indonesia",
    flag: "🇮🇩",
    region: "asia",
    dates: ["2026-12-26", "2026-12-27"],
    category: "concert",
  },

  // ── North America ─────────────────────────────────────────────────────────
  {
    id: "usa-tampa",
    title: "BTS World Tour: Arirang",
    venue: "Raymond James Stadium",
    city: "Tampa",
    country: "EE.UU.",
    flag: "🇺🇸",
    region: "north_america",
    dates: ["2026-04-25", "2026-04-26"],
    category: "concert",
  },
  {
    id: "usa-elpaso",
    title: "BTS World Tour: Arirang",
    venue: "Sun Bowl Stadium",
    city: "El Paso",
    country: "EE.UU.",
    flag: "🇺🇸",
    region: "north_america",
    dates: ["2026-05-02", "2026-05-03"],
    category: "concert",
  },
  {
    id: "usa-stanford",
    title: "BTS World Tour: Arirang",
    venue: "Stanford Stadium",
    city: "Stanford",
    country: "EE.UU.",
    flag: "🇺🇸",
    region: "north_america",
    dates: ["2026-05-16", "2026-05-17", "2026-05-19"],
    category: "concert",
  },
  {
    id: "usa-lasvegas",
    title: "BTS World Tour: Arirang",
    venue: "Allegiant Stadium",
    city: "Las Vegas",
    country: "EE.UU.",
    flag: "🇺🇸",
    region: "north_america",
    dates: ["2026-05-23", "2026-05-24", "2026-05-27", "2026-05-28"],
    category: "concert",
  },
  {
    id: "usa-eastrutherford",
    title: "BTS World Tour: Arirang",
    venue: "MetLife Stadium",
    city: "East Rutherford",
    country: "EE.UU.",
    flag: "🇺🇸",
    region: "north_america",
    dates: ["2026-08-01", "2026-08-02"],
    category: "concert",
  },
  {
    id: "usa-foxborough",
    title: "BTS World Tour: Arirang",
    venue: "Gillette Stadium",
    city: "Foxborough",
    country: "EE.UU.",
    flag: "🇺🇸",
    region: "north_america",
    dates: ["2026-08-05", "2026-08-06"],
    category: "concert",
  },
  {
    id: "usa-baltimore",
    title: "BTS World Tour: Arirang",
    venue: "M&T Bank Stadium",
    city: "Baltimore",
    country: "EE.UU.",
    flag: "🇺🇸",
    region: "north_america",
    dates: ["2026-08-10", "2026-08-11"],
    category: "concert",
  },
  {
    id: "usa-arlington",
    title: "BTS World Tour: Arirang",
    venue: "AT&T Stadium",
    city: "Arlington",
    country: "EE.UU.",
    flag: "🇺🇸",
    region: "north_america",
    dates: ["2026-08-15", "2026-08-16"],
    category: "concert",
  },
  {
    id: "can-toronto",
    title: "BTS World Tour: Arirang",
    venue: "Rogers Centre",
    city: "Toronto",
    country: "Canadá",
    flag: "🇨🇦",
    region: "north_america",
    dates: ["2026-08-22", "2026-08-23"],
    category: "concert",
  },
  {
    id: "usa-chicago",
    title: "BTS World Tour: Arirang",
    venue: "Soldier Field",
    city: "Chicago",
    country: "EE.UU.",
    flag: "🇺🇸",
    region: "north_america",
    dates: ["2026-08-27", "2026-08-28"],
    category: "concert",
  },
  {
    id: "usa-losangeles",
    title: "BTS World Tour: Arirang",
    venue: "SoFi Stadium",
    city: "Los Ángeles",
    country: "EE.UU.",
    flag: "🇺🇸",
    region: "north_america",
    dates: ["2026-09-01", "2026-09-02", "2026-09-05", "2026-09-06"],
    category: "concert",
  },

  // ── Europe ────────────────────────────────────────────────────────────────
  {
    id: "esp-madrid",
    title: "BTS World Tour: Arirang",
    venue: "Estadio Cívitas Metropolitano",
    city: "Madrid",
    country: "España",
    flag: "🇪🇸",
    region: "europe",
    dates: ["2026-06-26", "2026-06-27"],
    category: "concert",
  },
  {
    id: "bel-brussels",
    title: "BTS World Tour: Arirang",
    venue: "King Baudouin Stadium",
    city: "Bruselas",
    country: "Bélgica",
    flag: "🇧🇪",
    region: "europe",
    dates: ["2026-07-01", "2026-07-02"],
    category: "concert",
  },
  {
    id: "gbr-london",
    title: "BTS World Tour: Arirang",
    venue: "Wembley Stadium",
    city: "Londres",
    country: "Reino Unido",
    flag: "🇬🇧",
    region: "europe",
    dates: ["2026-07-06", "2026-07-07"],
    category: "concert",
  },
  {
    id: "deu-munich",
    title: "BTS World Tour: Arirang",
    venue: "Olympiastadion",
    city: "Múnich",
    country: "Alemania",
    flag: "🇩🇪",
    region: "europe",
    dates: ["2026-07-11", "2026-07-12"],
    category: "concert",
  },
  {
    id: "fra-paris",
    title: "BTS World Tour: Arirang",
    venue: "Stade de France",
    city: "París",
    country: "Francia",
    flag: "🇫🇷",
    region: "europe",
    dates: ["2026-07-17", "2026-07-18"],
    category: "concert",
  },

  // ── South America ─────────────────────────────────────────────────────────
  {
    id: "col-bogota",
    title: "BTS World Tour: Arirang",
    venue: "Estadio El Campín",
    city: "Bogotá",
    country: "Colombia",
    flag: "🇨🇴",
    region: "south_america",
    dates: ["2026-10-02", "2026-10-03"],
    category: "concert",
  },
  {
    id: "per-lima",
    title: "BTS World Tour: Arirang",
    venue: "Estadio Nacional",
    city: "Lima",
    country: "Perú",
    flag: "🇵🇪",
    region: "south_america",
    dates: ["2026-10-07", "2026-10-09", "2026-10-10"],
    category: "concert",
  },
  {
    id: "chl-santiago",
    title: "BTS World Tour: Arirang",
    venue: "Estadio Monumental",
    city: "Santiago",
    country: "Chile",
    flag: "🇨🇱",
    region: "south_america",
    dates: ["2026-10-14", "2026-10-16", "2026-10-17"],
    category: "concert",
  },
  {
    id: "arg-buenosaires",
    title: "BTS World Tour: Arirang",
    venue: "Estadio Único de La Plata",
    city: "La Plata / Buenos Aires",
    country: "Argentina",
    flag: "🇦🇷",
    region: "south_america",
    dates: ["2026-10-21", "2026-10-23", "2026-10-24"],
    category: "concert",
    isArgentina: true,
  },
  {
    id: "bra-saopaulo",
    title: "BTS World Tour: Arirang",
    venue: "Allianz Parque",
    city: "São Paulo",
    country: "Brasil",
    flag: "🇧🇷",
    region: "south_america",
    dates: ["2026-10-28", "2026-10-30", "2026-10-31"],
    category: "concert",
  },

  // ── Oceania / Asia (2027) ─────────────────────────────────────────────────
  {
    id: "aus-melbourne",
    title: "BTS World Tour: Arirang",
    venue: "MCG",
    city: "Melbourne",
    country: "Australia",
    flag: "🇦🇺",
    region: "oceania",
    dates: ["2027-02-12", "2027-02-13"],
    category: "concert",
  },
  {
    id: "aus-sydney",
    title: "BTS World Tour: Arirang",
    venue: "Stadium Australia",
    city: "Sídney",
    country: "Australia",
    flag: "🇦🇺",
    region: "oceania",
    dates: ["2027-02-20", "2027-02-21"],
    category: "concert",
  },
  {
    id: "hkg-hongkong",
    title: "BTS World Tour: Arirang",
    venue: "Hong Kong Stadium",
    city: "Hong Kong",
    country: "Hong Kong",
    flag: "🇭🇰",
    region: "oceania",
    dates: ["2027-03-04", "2027-03-06", "2027-03-07"],
    category: "concert",
  },
  {
    id: "phl-manila",
    title: "BTS World Tour: Arirang",
    venue: "Philippine Arena",
    city: "Manila",
    country: "Filipinas",
    flag: "🇵🇭",
    region: "oceania",
    dates: ["2027-03-13", "2027-03-14"],
    category: "concert",
  },
];

export function getTodayEvent(from: Date = new Date()): BtsEvent | null {
  const today = from.toISOString().slice(0, 10);
  return BTS_EVENTS.find((e) => e.dates.includes(today)) ?? null;
}

export function getNextEvent(from: Date = new Date()): BtsEvent | null {
  const today = from.toISOString().slice(0, 10);
  return (
    BTS_EVENTS
      .filter((e) => e.dates.some((d) => d > today))
      .sort((a, b) => {
        const aNext = a.dates.find((d) => d > today)!;
        const bNext = b.dates.find((d) => d > today)!;
        return aNext.localeCompare(bNext);
      })[0] ?? null
  );
}

export function getArgentinaEvent(): BtsEvent | null {
  return BTS_EVENTS.find((e) => e.isArgentina) ?? null;
}
