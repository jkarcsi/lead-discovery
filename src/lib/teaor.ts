// TEÁOR'08 (Hungarian activity classification, ≈ NACE Rev.2) → Procura taxonomy
// (pure). The company registry (e-beszámoló) tags each company with a TEÁOR
// code, which authoritatively categorizes it. Mapped by 4-digit code prefix.

import { categoriesForCodes, type PrefixRule } from "./prefixMap.js";

const TEAOR_RULES: PrefixRule[] = [
  { prefix: "812", category: "cleaning" }, // 8121/8122/8129 building & industrial cleaning
  { prefix: "4322", category: "hvac" }, // víz-, gáz-, fűtés-, légkondicionáló-szerelés
  { prefix: "3530", category: "hvac" }, // gőzellátás, légkondicionálás
  { prefix: "80", category: "security" }, // 80xx biztonsági, nyomozói tevékenység
  { prefix: "8425", category: "fire-safety" }, // tűzoltóság, tűzvédelem
  { prefix: "620", category: "it-support" }, // 6201/6202/6203/6209 IT programming/consult/ops
  { prefix: "6311", category: "it-support" }, // adatfeldolgozás, web-hoszting
  { prefix: "9511", category: "it-support" }, // számítógép, -periféria javítása
];

// Keep the 4-digit class code (TEÁOR codes may be written "81.21" or "8121").
const normalizeTeaor = (code: string): string => String(code).replace(/\D/g, "").slice(0, 4);

export function teaorToCategories(teaorCodes: string[]): string[] {
  return categoriesForCodes(teaorCodes, normalizeTeaor, TEAOR_RULES);
}
