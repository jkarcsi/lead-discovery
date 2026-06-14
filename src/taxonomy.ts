// Procura-aligned taxonomy: category and region ids are IDENTICAL to Procura's
// (src/lib/taxonomy.ts there) so collected leads slot straight into Procura's
// matching. Ids and names mirror Procura (Hungarian, the market); keywords here
// may be a superset of Procura's for better collection recall.

export type CategoryDef = {
  id: string;
  name: string;
  keywords: string[];
};

export const CATEGORIES: CategoryDef[] = [
  {
    id: "takaritas",
    name: "Takarítás",
    keywords: ["takarít", "takarit", "tisztít", "tisztit", "higién", "irodatakar", "clean", "janitor"],
  },
  {
    id: "hvac",
    name: "HVAC / klíma karbantartás",
    keywords: ["klíma", "klima", "hvac", "légkondi", "legkondi", "hűtés", "hutes", "futes", "fűtés", "szellőz", "szelloz", "air condition", "cooling", "heating", "ventilat"],
  },
  {
    id: "orzes-vedelem",
    name: "Őrzés-védelem",
    keywords: ["őrzés", "orzes", "biztonsági", "biztonsag", "vagyonvéd", "vagyonved", "portaszolgálat", "portaszolgalat", "beléptet", "beleptet", "security", "guard"],
  },
  {
    id: "munkavedelem",
    name: "Munkavédelem",
    keywords: ["munkavéd", "munkaved", "kockázatértékel", "kockazatertekel", "üzemorvos", "uzemorvos", "munkabiztons", "occupational safety", "workplace safety", "risk assessment"],
  },
  {
    id: "tuzvedelem",
    name: "Tűzvédelem",
    keywords: ["tűzvéd", "tuzved", "tűzoltó", "tuzolto", "tűzjelz", "tuzjelz", "menekülés", "menekules", "fire safety", "fire protection", "fire alarm", "extinguisher"],
  },
  {
    id: "it-support",
    name: "IT üzemeltetés / support",
    keywords: ["it ", "it-", "informatik", "rendszergazda", "support", "szerver", "server", "hálózat", "halozat", "network", "microsoft 365", "laptop", "sysadmin", "helpdesk"],
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
