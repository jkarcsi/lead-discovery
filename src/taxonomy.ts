// Procura-aligned taxonomy: identical category and region ids so collected
// leads slot straight into Procura's matching. Names/keywords are Hungarian
// (the market); ids are English (code-level).

export type CategoryDef = {
  id: string;
  name: string;
  // Stem/substring keywords: matched anywhere in the folded text so Hungarian
  // compounds are caught (e.g. "irodatakarítás" matches "takarít"). Safe only for
  // distinctive, longer stems — short or generic tokens belong in `wordKeywords`.
  keywords: string[];
  // Whole-word keywords: matched only as standalone tokens (bounded left and
  // right by a non-letter/digit). Use for short or ambiguous tokens that would
  // otherwise hit unrelated words as substrings — e.g. "it" must not match
  // "Margit"/"nonprofit"/"fit", and "support" must not match "Bikesupport".
  wordKeywords?: string[];
};

export const CATEGORIES: CategoryDef[] = [
  {
    id: "cleaning",
    name: "Takarítás",
    keywords: ["takarít", "takarit", "tisztít", "tisztit", "higién", "irodatakar", "janitor"],
    wordKeywords: ["clean", "cleaning"],
  },
  {
    id: "hvac",
    name: "HVAC / klíma karbantartás",
    keywords: ["klíma", "klima", "légkondi", "legkondi", "hűtés", "hutes", "futes", "fűtés", "szellőz", "szelloz", "ventilat"],
    wordKeywords: ["hvac", "air condition", "cooling", "heating"],
  },
  {
    id: "security",
    name: "Őrzés-védelem",
    keywords: ["őrzés", "orzes", "biztonsági", "biztonsag", "vagyonvéd", "vagyonved", "portaszolgálat", "portaszolgalat", "beléptet", "beleptet"],
    wordKeywords: ["security", "guard"],
  },
  {
    id: "occupational-safety",
    name: "Munkavédelem",
    keywords: ["munkavéd", "munkaved", "kockázatértékel", "kockazatertekel", "üzemorvos", "uzemorvos", "munkabiztons"],
    wordKeywords: ["occupational safety", "workplace safety", "risk assessment"],
  },
  {
    id: "fire-safety",
    name: "Tűzvédelem",
    keywords: ["tűzvéd", "tuzved", "tűzoltó", "tuzolto", "tűzjelz", "tuzjelz", "menekülés", "menekules"],
    wordKeywords: ["fire safety", "fire protection", "fire alarm", "extinguisher"],
  },
  {
    id: "it-support",
    name: "IT üzemeltetés / support",
    // Distinctive Hungarian/compound stems are safe as substrings…
    keywords: ["informatik", "rendszergazda", "szerver", "hálózat", "halozat", "számítógép", "szamitogep", "számítástechnik", "szamitastechnik", "sysadmin", "helpdesk"],
    // …but short/generic tokens must be whole words: "it" (not Margit/nonprofit),
    // "support" (not Bikesupport), "server" (not observer).
    wordKeywords: ["it", "support", "server", "network", "laptop", "microsoft 365"],
  },
];

export const REGIONS: { id: string; name: string }[] = [
  { id: "budapest", name: "Budapest" },
  { id: "pest", name: "Pest vármegye" },
  { id: "bacs-kiskun", name: "Bács-Kiskun" },
  { id: "baranya", name: "Baranya" },
  { id: "bekes", name: "Békés" },
  { id: "borsod-abauj-zemplen", name: "Borsod-Abaúj-Zemplén" },
  { id: "csongrad-csanad", name: "Csongrád-Csanád" },
  { id: "fejer", name: "Fejér" },
  { id: "gyor-moson-sopron", name: "Győr-Moson-Sopron" },
  { id: "hajdu-bihar", name: "Hajdú-Bihar" },
  { id: "heves", name: "Heves" },
  { id: "jasz-nagykun-szolnok", name: "Jász-Nagykun-Szolnok" },
  { id: "komarom-esztergom", name: "Komárom-Esztergom" },
  { id: "nograd", name: "Nógrád" },
  { id: "somogy", name: "Somogy" },
  { id: "szabolcs-szatmar-bereg", name: "Szabolcs-Szatmár-Bereg" },
  { id: "tolna", name: "Tolna" },
  { id: "vas", name: "Vas" },
  { id: "veszprem", name: "Veszprém" },
  { id: "zala", name: "Zala" },
];

export const REGION_KEYWORDS: Record<string, string[]> = {
  budapest: ["budapest", "bp", "főváros", "fovaros"],
  pest: ["pest vármegye", "pest megye", "érd", "erd", "gödöllő", "godollo", "vác", "vac", "cegléd", "cegled", "szentendre", "dunakeszi", "budaörs", "budaors"],
  "bacs-kiskun": ["kecskemét", "kecskemet", "baja", "kiskunfélegyháza"],
  baranya: ["pécs", "pecs", "mohács", "mohacs"],
  bekes: ["békéscsaba", "bekescsaba", "gyula", "orosháza"],
  "borsod-abauj-zemplen": ["miskolc", "ózd", "ozd", "kazincbarcika"],
  "csongrad-csanad": ["szeged", "hódmezővásárhely", "hodmezovasarhely", "szentes"],
  fejer: ["székesfehérvár", "szekesfehervar", "dunaújváros", "dunaujvaros"],
  "gyor-moson-sopron": ["győr", "gyor", "sopron", "mosonmagyaróvár", "mosonmagyarovar"],
  "hajdu-bihar": ["debrecen", "hajdúszoboszló", "hajduszoboszlo"],
  heves: ["eger", "gyöngyös", "gyongyos", "hatvan"],
  "jasz-nagykun-szolnok": ["szolnok", "jászberény", "jaszbereny"],
  "komarom-esztergom": ["tatabánya", "tatabanya", "esztergom", "komárom", "komarom", "tata"],
  nograd: ["salgótarján", "salgotarjan", "balassagyarmat"],
  somogy: ["kaposvár", "kaposvar", "siófok", "siofok"],
  "szabolcs-szatmar-bereg": ["nyíregyháza", "nyiregyhaza", "mátészalka", "mateszalka"],
  tolna: ["szekszárd", "szekszard", "paks"],
  vas: ["szombathely", "sárvár", "sarvar", "kőszeg", "koszeg"],
  veszprem: ["veszprém", "veszprem", "pápa", "papa", "ajka", "balatonfüred", "balatonfured"],
  zala: ["zalaegerszeg", "nagykanizsa", "keszthely"],
};
