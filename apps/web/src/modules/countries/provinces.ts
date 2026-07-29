import "server-only";
import { db } from "@/lib/supabase";

// Built-in level-1 area lists, seeded when a country is added. Everything stays
// editable afterwards under Countries → Areas, where deeper levels are added.
const PROVINCES: Record<string, string[]> = {
  TH: ["Amnat Charoen","Ang Thong","Bangkok","Bueng Kan","Buri Ram","Chachoengsao","Chai Nat","Chaiyaphum","Chanthaburi","Chiang Mai","Chiang Rai","Chon Buri","Chumphon","Kalasin","Kamphaeng Phet","Kanchanaburi","Khon Kaen","Krabi","Lampang","Lamphun","Loei","Lop Buri","Mae Hong Son","Maha Sarakham","Mukdahan","Nakhon Nayok","Nakhon Pathom","Nakhon Phanom","Nakhon Ratchasima","Nakhon Sawan","Nakhon Si Thammarat","Nan","Narathiwat","Nong Bua Lam Phu","Nong Khai","Nonthaburi","Pathum Thani","Pattani","Phangnga","Phatthalung","Phayao","Phetchabun","Phetchaburi","Phichit","Phitsanulok","Phra Nakhon Si Ayutthaya","Phrae","Phuket","Prachin Buri","Prachuap Khiri Khan","Ranong","Ratchaburi","Rayong","Roi Et","Sa Kaeo","Sakon Nakhon","Samut Prakan","Samut Sakhon","Samut Songkhram","Saraburi","Satun","Si Sa Ket","Sing Buri","Songkhla","Sukhothai","Suphan Buri","Surat Thani","Surin","Tak","Trang","Trat","Ubon Ratchathani","Udon Thani","Uthai Thani","Uttaradit","Yala","Yasothon"],
  VN: ["An Giang","Bac Ninh","Ca Mau","Can Tho","Cao Bang","Da Nang","Dak Lak","Dien Bien","Dong Nai","Dong Thap","Gia Lai","Ha Noi","Ha Tinh","Hai Phong","Hue","Hung Yen","Khanh Hoa","Lai Chau","Lam Dong","Lang Son","Lao Cai","Ninh Binh","Nghe An","Phu Tho","Quang Ngai","Quang Ninh","Quang Tri","Son La","Tay Ninh","Thai Nguyen","Thanh Hoa","Ho Chi Minh City","Tuyen Quang","Vinh Long"],
  SG: ["Central","East","North","North-East","West"],
  MY: ["Johor","Kedah","Kelantan","Kuala Lumpur","Labuan","Melaka","Negeri Sembilan","Pahang","Penang","Perak","Perlis","Putrajaya","Sabah","Sarawak","Selangor","Terengganu"],
  AU: ["Australian Capital Territory","New South Wales","Northern Territory","Queensland","South Australia","Tasmania","Victoria","Western Australia"],
};

/** The language trainees are spoken to in, per country. */
const LANGUAGES: Record<string, string> = {
  TH: "Thai",
  VN: "Vietnamese",
  MY: "Malay",
  SG: "English",
  AU: "English",
};

/** Level names per country — this is what makes the address 1, 2 or 3 deep. */
const LEVELS: Record<string, string[]> = {
  TH: ["Province", "District", "Sub-district"],
  VN: ["Province", "Ward"],
  MY: ["State", "District", "Mukim"],
  SG: ["District"],
  AU: ["State", "Suburb"],
};

export async function seedProvinces(countryId: string, code: string): Promise<void> {
  const key = code.toUpperCase();
  const levels = LEVELS[key];
  const language = LANGUAGES[key];
  const patch: Record<string, unknown> = {};
  if (levels) patch.address_levels = levels;
  if (language) patch.language = language;
  if (Object.keys(patch).length > 0) await db().from("countries").update(patch).eq("id", countryId);

  const list = PROVINCES[key];
  if (!list?.length) return;
  await db()
    .from("regions")
    .upsert(
      list.map((name, i) => ({ country_id: countryId, parent_id: null, level: 1, name, sort: (i + 1) * 10 })),
      { onConflict: "country_id,parent_id,name" }
    );
}
