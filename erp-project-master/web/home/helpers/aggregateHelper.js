import { isArray, take } from "lodash";
import BosError, { BOS_ERROR } from "./errorHelper";

export const AGGREGATE_TYPE = {
  COUNT: "count",
  COUNT_PER_DAY: "countPerDay",
};

export const getDrillDownName = (namespace, path, level, match) => {
  if (!isArray(path)) {
    throw new BosError("path is not an array", BOS_ERROR.INVALID_ARG_VALUE);
  }

  const pathLength = path.length;
  const matchCondition = take(path, level)
    .map((p) => `${p}[v=${JSON.stringify(match[p])}]`)
    .join(".");

  if (level >= pathLength) {
    return `${namespace}.${matchCondition}.detail[p=${match.page};ipp=${match.itemsPerPage}]`;
  }

  return `${namespace}.${matchCondition || path[0]}`;
};
