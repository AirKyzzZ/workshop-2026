import { test } from "node:test";
import assert from "node:assert/strict";
import { dureeScene, framesTotal, type Scene } from "./timing.ts";

const scene: Scene = { id: "1.1", acte: 1, dureeMinS: 4 };

test("une scène sans réplique dure sa durée minimale", () => {
  assert.equal(dureeScene(scene), 4);
});

test("une réplique plus longue que le minimum allonge la scène de la marge", () => {
  assert.equal(dureeScene(scene, { texte: "", fichier: "", dureeS: 6, genere: true }), 6.6);
});

test("le total refuse de dépasser 4:45", () => {
  const scenes = Array.from({ length: 30 }, (_, i) => ({ id: `${i}`, acte: 1, dureeMinS: 10 }));
  assert.throws(() => framesTotal(scenes, {}, 30), /trop longue/);
});

test("le total additionne les scènes en images", () => {
  assert.equal(framesTotal([scene, { ...scene, id: "1.2" }], {}, 30), 240);
});
