import assert from "node:assert";
import { appendSeg, locateSeg } from "../segs.js";
import { step, close } from "../segrun.js";

const base = {
  budget: 1,
  state: { segs: [[0, 10]], found: [], ledger: [], applied: [] },
  events: [{ id: 1, kind: "find", key: 3 }],
  overlap_error_code: "E_OVERLAP", range_error_code: "E_BAD_RANGE",
  event_error_code: "E_BAD_EVENT"
};

let failed = 0;
function check(name, fn) {
  try { fn(); console.log("ok " + name); } catch (e) { failed += 1; console.log("FAIL " + name + " :: " + e.message); }
}

check("appendSeg returns segs", () => {
  assert.ok(Array.isArray(appendSeg([[0, 5]], 5, 9)));
});

check("locateSeg returns a number", () => {
  assert.strictEqual(typeof locateSeg([[0, 5]], 2), "number");
});

check("step returns a state", () => {
  assert.strictEqual(typeof step(base).state, "object");
});

check("close returns a state", () => {
  assert.strictEqual(typeof close(base).state, "object");
});

console.log("5 cases, " + failed + " failed");
process.exit(failed === 0 ? 0 : 1);
