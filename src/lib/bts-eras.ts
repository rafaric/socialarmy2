export interface BtsEra {
  key: string;
  label: string;
  year: number;
  color: string;      // accent color
  bg: string;         // background tint (low opacity)
  description: string;
}

export const BTS_ERAS: BtsEra[] = [
  {
    key: "2cool4skool",
    label: "2 Cool 4 Skool",
    year: 2013,
    color: "#e8b86d",
    bg: "rgba(232, 184, 109, 0.15)",
    description: "El debut",
  },
  {
    key: "hyyh",
    label: "화양연화",
    year: 2015,
    color: "#ff8c69",
    bg: "rgba(255, 140, 105, 0.15)",
    description: "The Most Beautiful Moment in Life",
  },
  {
    key: "wings",
    label: "Wings",
    year: 2016,
    color: "#9b6fe8",
    bg: "rgba(155, 111, 232, 0.15)",
    description: "You Never Walk Alone",
  },
  {
    key: "love_yourself",
    label: "Love Yourself",
    year: 2017,
    color: "#f06292",
    bg: "rgba(240, 98, 146, 0.15)",
    description: "Tear · Answer",
  },
  {
    key: "mots",
    label: "Map of the Soul",
    year: 2019,
    color: "#4fc3f7",
    bg: "rgba(79, 195, 247, 0.15)",
    description: "Persona · 7",
  },
  {
    key: "be",
    label: "BE",
    year: 2020,
    color: "#a5d6a7",
    bg: "rgba(165, 214, 167, 0.15)",
    description: "Life Goes On",
  },
  {
    key: "butter",
    label: "Butter",
    year: 2021,
    color: "#f9d342",
    bg: "rgba(249, 211, 66, 0.15)",
    description: "Permission to Dance",
  },
  {
    key: "proof",
    label: "Proof",
    year: 2022,
    color: "#c9a84c",
    bg: "rgba(201, 168, 76, 0.15)",
    description: "Antología",
  },
  {
    key: "arirang",
    label: "Arirang",
    year: 2025,
    color: "#7c4dce",
    bg: "rgba(124, 77, 206, 0.15)",
    description: "El regreso",
  },
];

/** Devuelve la era que estaba activa en un año dado */
export function getEraByYear(year: number): BtsEra {
  const sorted = [...BTS_ERAS].sort((a, b) => b.year - a.year);
  return sorted.find((e) => e.year <= year) ?? BTS_ERAS[0];
}

/** Devuelve una era por su key */
export function getEraByKey(key: string): BtsEra | undefined {
  return BTS_ERAS.find((e) => e.key === key);
}
