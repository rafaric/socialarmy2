export interface BtsMember {
  key: string;
  name: string;
  fullName: string;
  photo: string;
  color: string;
}

export const BTS_MEMBERS: BtsMember[] = [
  {
    key: "rm",
    name: "RM",
    fullName: "Kim Namjoon",
    photo: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/56/RM_at_W_Korea_Love_Your_W%2C_November_2023.jpg/250px-RM_at_W_Korea_Love_Your_W%2C_November_2023.jpg",
    color: "#9E9E9E",
  },
  {
    key: "jin",
    name: "Jin",
    fullName: "Kim Seokjin",
    photo: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4b/BTS_Jin_at_Maison_Fred%2C_13_March_2025_04.png/250px-BTS_Jin_at_Maison_Fred%2C_13_March_2025_04.png",
    color: "#EC407A",
  },
  {
    key: "suga",
    name: "Suga",
    fullName: "Min Yoongi",
    photo: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ea/Suga_for_Valentino_and_Marie_Claire_Korea_06.jpg/250px-Suga_for_Valentino_and_Marie_Claire_Korea_06.jpg",
    color: "#616161",
  },
  {
    key: "jhope",
    name: "J-Hope",
    fullName: "Jung Hoseok",
    photo: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/57/J-Hope_at_W_Korea_Breast_Cancer_Campaign%2C_15_October_2025.png/250px-J-Hope_at_W_Korea_Breast_Cancer_Campaign%2C_15_October_2025.png",
    color: "#AEEA00",
  },
  {
    key: "jimin",
    name: "Jimin",
    fullName: "Park Jimin",
    photo: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/33/Jimin_on_the_way_to_SBS_Radio%2C_31_March_2023_%282%29.jpg/250px-Jimin_on_the_way_to_SBS_Radio%2C_31_March_2023_%282%29.jpg",
    color: "#FFD600",
  },
  {
    key: "v",
    name: "V",
    fullName: "Kim Taehyung",
    photo: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/BTS%27s_V_20251004_04.jpg/250px-BTS%27s_V_20251004_04.jpg",
    color: "#7C3AED",
  },
  {
    key: "jungkook",
    name: "Jungkook",
    fullName: "Jeon Jungkook",
    photo: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f6/Jung_Kook_of_BTS%2C_February_12%2C_2026_%281%29.png/250px-Jung_Kook_of_BTS%2C_February_12%2C_2026_%281%29.png",
    color: "#EF5350",
  },
];

export function getMemberByKey(key: string): BtsMember | undefined {
  return BTS_MEMBERS.find((m) => m.key === key);
}
