// segs.js：段表操作（每段是 [起点, 终点]，半开区间 [起点, 终点)，
// 最后一段的终点按落在段内处理，保证已覆盖轴上的点都有唯一归属）
function segError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

// 把一段接到段表末尾：起点不大于终点，且正好接在最后一段的终点上。
export function appendSeg(segs, from, to) {
  if (!Number.isFinite(from) || !Number.isFinite(to)) {
    throw segError("E_BAD_EVENT", "段端点必须是数字");
  }
  if (from > to) {
    throw segError("E_BAD_RANGE", "起点不能大于终点");
  }
  if (segs.length > 0 && from !== segs[segs.length - 1][1]) {
    throw segError("E_OVERLAP", "新段起点必须正好接在最后一段终点上");
  }
  return segs.concat([[from, to]]);
}

// 键落在哪一段就返回那一段的下标（从零数），哪个段都不落返回 -1。
export function locateSeg(segs, key) {
  for (let index = 0; index < segs.length; index += 1) {
    const from = segs[index][0];
    const to = segs[index][1];
    const coversTail = index === segs.length - 1 && key === to;
    if ((key >= from && key < to) || coversTail) {
      return index;
    }
  }
  return -1;
}
