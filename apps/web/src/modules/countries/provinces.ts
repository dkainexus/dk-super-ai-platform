import "server-only";
import { db } from "@/lib/supabase";

// Built-in state / province lists, seeded when a country is added. Everything
// stays editable afterwards under Country Settings → States / Provinces.
const PROVINCES: Record<string, string[]> = {
  TH: ["Amnat Charoen","Ang Thong","Bangkok","Bueng Kan","Buri Ram","Chachoengsao","Chai Nat","Chaiyaphum","Chanthaburi","Chiang Mai","Chiang Rai","Chon Buri","Chumphon","Kalasin","Kamphaeng Phet","Kanchanaburi","Khon Kaen","Krabi","Lampang","Lamphun","Loei","Lop Buri","Mae Hong Son","Maha Sarakham","Mukdahan","Nakhon Nayok","Nakhon Pathom","Nakhon Phanom","Nakhon Ratchasima","Nakhon Sawan","Nakhon Si Thammarat","Nan","Narathiwat","Nong Bua Lam Phu","Nong Khai","Nonthaburi","Pathum Thani","Pattani","Phangnga","Phatthalung","Phayao","Phetchabun","Phetchaburi","Phichit","Phitsanulok","Phra Nakhon Si Ayutthaya","Phrae","Phuket","Prachin Buri","Prachuap Khiri Khan","Ranong","Ratchaburi","Rayong","Roi Et","Sa Kaeo","Sakon Nakhon","Samut Prakan","Samut Sakhon","Samut Songkhram","Saraburi","Satun","Si Sa Ket","Sing Buri","Songkhla","Sukhothai","Suphan Buri","Surat Thani","Surin","Tak","Trang","Trat","Ubon Ratchathani","Udon Thani","Uthai Thani","Uttaradit","Yala","Yasothon"],
  VN: ["An Giang","Bac Ninh","Ca Mau","Can Tho","Cao Bang","Da Nang","Dak Lak","Dien Bien","Dong Nai","Dong Thap","Gia Lai","Ha Noi","Ha Tinh","Hai Phong","Hue","Hung Yen","Khanh Hoa","Lai Chau","Lam Dong","Lang Son","Lao Cai","Ninh Binh","Nghe An","Phu Tho","Quang Ngai","Quang Ninh","Quang Tri","Son La","Tay Ninh","Thai Nguyen","Thanh Hoa","Ho Chi Minh City","Tuyen Quang","Vinh Long"],
  SG: ["Central","East","North","North-East","West"],
  MY: ["Johor","Kedah","Kelantan","Kuala Lumpur","Labuan","Melaka","Negeri Sembilan","Pahang","Penang","Perak","Perlis","Putrajaya","Sabah","Sarawak","Selangor","Terengganu"],
  AU: ["Australian Capital Territory","New South Wales","Northern Territory","Queensland","South Australia","Tasmania","Victoria","Western Australia"],
};

export async function seedProvinces(countryId: string, code: string): Promise<void> {
  const list = PROVINCES[code.toUpperCase()];
  if (!list?.length) return;
  await db()
    .from("provinces")
    .upsert(
      list.map((name, i) => ({ country_id: countryId, name, sort: (i + 1) * 10 })),
      { onConflict: "country_id,name" }
    );
}
