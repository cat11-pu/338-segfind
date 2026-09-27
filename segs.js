// segs.js：段表操作（纯函数，不改正传入的段表）
function failure(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

export function appendSeg(segs, from, to) {
  if (typeof from !== "number" || typeof to !== "number"
      || !Number.isFinite(from) || !Number.isFinite(to) || from > to) {
    throw failure("E_BAD_RANGE", "起点不能大于终点：" + from + " -> " + to);
  }
  if (segs.length > 0) {
    const lastEnd = segs[segs.length - 1][1];
    if (from !== lastEnd) {
      throw failure("E_OVERLAP",
        "新段起点 " + from + " 必须正好接上最后一段终点 " + lastEnd);
    }
  }
  return segs.concat([[from, to]]);
}

export function locateSeg(segs, key) {
  for (let i = 0; i < segs.length; i += 1) {
    if (segs[i][0] <= key && key <= segs[i][1]) return i;
  }
  return -1;
}
