// segrun.js：按处理预算推进段表，预算用尽的事件连着载压账，收尾时不限预算清账。
import { appendSeg, locateSeg } from "./segs.js";

function error(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

function codes(spec) {
  return {
    overlap: spec.overlap_error_code || "E_OVERLAP",
    range: spec.range_error_code || "E_BAD_RANGE",
    badEvent: spec.event_error_code || "E_BAD_EVENT"
  };
}

function isNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

// 事件转账上的紧凑三元组：append -> ["append", from, to]，find -> ["find", key, 0]
function toTuple(event) {
  if (event.kind === "append") {
    return ["append", event.from, event.to];
  }
  return ["find", event.key, 0];
}

// 结构校验：与预算无关，整批先判，不合法直接 E_BAD_EVENT。
function validate(events, badCode) {
  if (!Array.isArray(events)) {
    throw error(badCode, "events 必须是数组");
  }
  for (const event of events) {
    if (!event || typeof event !== "object") {
      throw error(badCode, "事件必须是对象");
    }
    if (event.kind === "append") {
      if (!isNumber(event.from) || !isNumber(event.to)) {
        throw error(badCode, "append 事件必须带数字 from 与 to");
      }
    } else if (event.kind === "find") {
      if (!isNumber(event.key)) {
        throw error(badCode, "find 事件必须带数字 key");
      }
    } else {
      throw error(badCode, "未知事件类型：" + String(event.kind));
    }
  }
}

function cloneState(state) {
  const source = state || {};
  return {
    segs: (source.segs || []).map(function (row) { return [row[0], row[1]]; }),
    found: (source.found || []).slice(),
    ledger: (source.ledger || []).map(function (row) { return row.slice(); }),
    applied: (source.applied || []).slice()
  };
}

// 真正落一条账（或事件）；区间写反/留缝在这里按当前段表判，随预算可能撞不上。
function applyTuple(state, tuple, codeSet) {
  const signature = JSON.stringify(tuple);
  if (state.applied.indexOf(signature) !== -1) {
    return false;
  }
  if (tuple[0] === "append") {
    let nextSegs;
    try {
      nextSegs = appendSeg(state.segs, tuple[1], tuple[2]);
    } catch (cause) {
      if (cause && cause.code === "E_BAD_RANGE") {
        throw error(codeSet.range, cause.message);
      }
      if (cause && cause.code === "E_OVERLAP") {
        throw error(codeSet.overlap, cause.message);
      }
      throw error(codeSet.badEvent, cause.message);
    }
    state.segs = nextSegs;
  } else {
    state.found.push(locateSeg(state.segs, tuple[1]));
  }
  state.applied.push(signature);
  return true;
}

export function step(spec) {
  const events = spec.events || [];
  const codeSet = codes(spec);
  validate(events, codeSet.badEvent);

  const state = cloneState(spec.state);
  const incomingLedger = spec.state && spec.state.ledger ? spec.state.ledger.length : 0;
  let budget = Number.isFinite(spec.budget) ? spec.budget : 0;
  let served = 0;

  // 先还上一轮压下来的账，旧账在前。
  const carried = state.ledger;
  state.ledger = [];
  for (const tuple of carried) {
    if (state.applied.indexOf(JSON.stringify(tuple)) !== -1) {
      continue;
    }
    if (budget <= 0) {
      state.ledger.push(tuple);
      continue;
    }
    if (applyTuple(state, tuple, codeSet)) {
      budget -= 1;
      served += 1;
    }
  }

  // 再处理本轮新事件；预算用尽就连着载压账，留到下一轮或收尾。
  for (const event of events) {
    const tuple = toTuple(event);
    if (state.applied.indexOf(JSON.stringify(tuple)) !== -1) {
      continue;
    }
    if (budget <= 0) {
      state.ledger.push(tuple);
      continue;
    }
    if (applyTuple(state, tuple, codeSet)) {
      budget -= 1;
      served += 1;
    }
  }

  return {
    state: state,
    served: served,
    ledger_before: state.ledger.length,
    ledger: state.ledger.map(function (row) { return row.slice(); }),
    judged: events.length,
    judged_bound: events.length + incomingLedger
  };
}

// 收尾：不限预算把账处理完，返回补齐条数。
export function close(spec) {
  const codeSet = codes(spec);
  const state = cloneState(spec.state);
  let catchup = 0;

  const carried = state.ledger;
  state.ledger = [];
  for (const tuple of carried) {
    if (applyTuple(state, tuple, codeSet)) {
      catchup += 1;
    }
  }

  return { state: state, catchup: catchup };
}
