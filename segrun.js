// segrun.js：按处理预算处理事件，用尽预算把余下事件压在账上，收尾不限预算补齐
import { appendSeg, locateSeg } from "./segs.js";

function failure(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function codeOf(spec, field, fallback) {
  return spec && typeof spec[field] === "string" && spec[field] ? spec[field] : fallback;
}

function toRecord(event) {
  const record = { id: event.id, kind: event.kind };
  if (event.kind === "find") {
    record.key = event.key;
  } else {
    record.from = event.from;
    record.to = event.to;
  }
  return record;
}

function normalizeRecord(row) {
  if (Array.isArray(row)) {
    return row[0] === "find"
      ? { id: row[3], kind: "find", key: row[1] }
      : { id: row[3], kind: "append", from: row[1], to: row[2] };
  }
  return { id: row.id, kind: row.kind, key: row.key, from: row.from, to: row.to };
}

function projectRecord(record) {
  return record.kind === "find"
    ? ["find", record.key, 0]
    : ["append", record.from, record.to];
}

function cloneState(state) {
  const source = state || {};
  return {
    segs: (source.segs || []).map((row) => [row[0], row[1]]),
    found: (source.found || []).slice(),
    ledger: (source.ledger || []).map((row) => Object.assign({}, normalizeRecord(row))),
    applied: (source.applied || []).slice()
  };
}

function validateEvent(event, eventCode) {
  if (!event || typeof event !== "object" || Array.isArray(event)) {
    throw failure(eventCode, "事件必须是对象");
  }
  if (event.kind === "append") {
    if (!Number.isFinite(event.from) || !Number.isFinite(event.to)) {
      throw failure(eventCode, "append 事件必须带数值 from 与 to");
    }
  } else if (event.kind === "find") {
    if (!Number.isFinite(event.key)) {
      throw failure(eventCode, "find 事件必须带数值 key");
    }
  } else {
    throw failure(eventCode, "不认识的事件类型：" + String(event.kind));
  }
}

function serve(state, record, codes) {
  if (record.kind === "find") {
    state.found.push(locateSeg(state.segs, record.key));
  } else {
    try {
      state.segs = appendSeg(state.segs, record.from, record.to);
    } catch (error) {
      if (error.code === "E_BAD_RANGE") throw failure(codes.range, error.message);
      if (error.code === "E_OVERLAP") throw failure(codes.overlap, error.message);
      throw error;
    }
  }
  if (record.id !== undefined && !state.applied.includes(record.id)) {
    state.applied.push(record.id);
  }
}

export function step(spec) {
  const input = spec || {};
  const events = input.events || [];
  const codes = {
    event: codeOf(input, "event_error_code", "E_BAD_EVENT"),
    range: codeOf(input, "range_error_code", "E_BAD_RANGE"),
    overlap: codeOf(input, "overlap_error_code", "E_OVERLAP")
  };

  events.forEach((event) => validateEvent(event, codes.event));

  const state = cloneState(input.state);
  const incomingLedger = state.ledger.length;
  const queue = state.ledger.slice();
  for (const event of events) {
    if (event.id !== undefined && state.applied.includes(event.id)) continue;
    queue.push(toRecord(event));
  }

  let remaining = Number.isFinite(input.budget)
    ? Math.max(0, Math.trunc(Number(input.budget)))
    : 0;
  let served = 0;
  let cursor = 0;
  while (cursor < queue.length && remaining > 0) {
    serve(state, queue[cursor], codes);
    cursor += 1;
    served += 1;
    remaining -= 1;
  }
  state.ledger = queue.slice(cursor);

  return {
    state,
    served,
    ledger_before: state.ledger.length,
    ledger: state.ledger.map(projectRecord),
    judged: served,
    judged_bound: events.length + incomingLedger
  };
}

export function close(spec) {
  const input = spec || {};
  const codes = {
    event: codeOf(input, "event_error_code", "E_BAD_EVENT"),
    range: codeOf(input, "range_error_code", "E_BAD_RANGE"),
    overlap: codeOf(input, "overlap_error_code", "E_OVERLAP")
  };

  const state = cloneState(input.state);
  let catchup = 0;
  while (state.ledger.length > 0) {
    const record = state.ledger.shift();
    serve(state, record, codes);
    catchup += 1;
  }
  return { state, catchup };
}
