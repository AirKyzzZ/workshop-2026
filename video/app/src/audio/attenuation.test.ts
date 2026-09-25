import { test } from "node:test";
import assert from "node:assert/strict";
import { volumeMusique } from "./attenuation.ts";

const proche = (valeur: number, attendu: number) =>
  assert.ok(
    Math.abs(valeur - attendu) < 1e-9,
    `${valeur} au lieu de ${attendu}`,
  );

const replique = { debut: 100, fin: 160 };

test("hors de toute voix, la musique reste au niveau de base", () => {
  assert.equal(volumeMusique(0, [replique]), 0.55);
  assert.equal(volumeMusique(92, [replique]), 0.55);
  assert.equal(volumeMusique(168, [replique]), 0.55);
  assert.equal(volumeMusique(50, []), 0.55);
});

test("pendant une voix, la musique descend au niveau sous la voix", () => {
  assert.equal(volumeMusique(100, [replique]), 0.14);
  assert.equal(volumeMusique(130, [replique]), 0.14);
  assert.equal(volumeMusique(160, [replique]), 0.14);
});

test("au milieu de la rampe, le volume est à mi-chemin, en descente comme en remontée", () => {
  proche(volumeMusique(96, [replique]), 0.345);
  proche(volumeMusique(164, [replique]), 0.345);
  proche(
    volumeMusique(98, [replique], { base: 1, sousVoix: 0, rampe: 4 }),
    0.5,
  );
});

test("deux voix proches fusionnent sans que la musique rebondisse entre elles", () => {
  const voix = [
    { debut: 200, fin: 240 },
    { debut: 100, fin: 190 },
  ];
  for (let frame = 100; frame <= 240; frame++) {
    assert.equal(volumeMusique(frame, voix), 0.14, `rebond à l'image ${frame}`);
  }
  assert.equal(volumeMusique(248, voix), 0.55);
});

test("deux voix éloignées laissent la musique remonter entre elles", () => {
  const voix = [
    { debut: 100, fin: 130 },
    { debut: 160, fin: 190 },
  ];
  assert.equal(volumeMusique(145, voix), 0.55);
});

test("une rampe nulle bascule d'un coup et un intervalle inversé est refusé", () => {
  assert.equal(volumeMusique(99, [replique], { rampe: 0 }), 0.55);
  assert.equal(volumeMusique(100, [replique], { rampe: 0 }), 0.14);
  assert.throws(() => volumeMusique(0, [{ debut: 10, fin: 5 }]), /inversé/);
});
