import nodeXlsx from "node-xlsx";
import { isArray, isUndefined, intersection, keys } from "lodash";
import date from "date-and-time";

import BosError, { BOS_ERROR } from "./errorHelper";
import { MODEL_RESERVED_FIELDS } from "./modelHelper";
import { DATA_TYPE } from "../constants/dataTypeConstant";
import { DATE_FORMAT, DATE_TIME_FORMAT } from "../constants/dateTimeConstant"; // TODO: select dateTimeFormat by language
import i18n from "../services/i18n";

export const getExcelBuffer = (dataSchema, fieldList, data) => {
  if (!dataSchema) {
    throw new BosError("dataSchema is undefined.", BOS_ERROR.INVALID_ARG_VALUE);
  }

  if (!data) {
    throw new BosError("data is undefined.", BOS_ERROR.INVALID_ARG_VALUE);
  }

  if (!isArray(data)) {
    throw new BosError("data is not an array.", BOS_ERROR.INVALID_ARG_VALUE);
  }

  const translatedHeader = [];
  const excelData = [];
  const columnList = intersection(fieldList, difference(keys(dataSchema), MODEL_RESERVED_FIELDS));

  // TODO: translated header name into request language

  columnList.forEach((fieldName) => {
    translatedHeader.push(i18n.t(fieldName));
  });

  excelData.push(translatedHeader);

  for (const row of data) {
    // convert "array of object" to 2D array
    const excelRow = [];

    for (const fieldName of columnList) {
      const { type, translated } = dataSchema[fieldName];
      const value = row[fieldName];

      if (translated) {
        excelRow.push(i18n.t(value));
        continue;
      }

      if (isUndefined(value)) {
        excelRow.push("");
        continue;
      }

      if (isArray(value)) {
        excelRow.push(JSON.stringify(value));
        continue;
      }

      switch (type) {
        case DATA_TYPE.DATE: {
          excelRow.push(value ? date.format(new Date(value), DATE_FORMAT) : "");
          break;
        }

        case DATA_TYPE.DATE_TIME: {
          excelRow.push(value ? date.format(new Date(value), DATE_TIME_FORMAT) : "");
          break;
        }

        case DATA_TYPE.ARRAY: {
          excelRow.push(JSON.stringify(value));
          break;
        }

        case DATA_TYPE.BOOLEAN:
        case DATA_TYPE.BOOL: {
          excelRow.push(value ? i18n.t("true") : i18n.t("false"));
          break;
        }

        case DATA_TYPE.RATE:
        case DATA_TYPE.NUMBER: {
          excelRow.push(value || "");
          break;
        }

        default: {
          excelRow.push(String(value)); // [..] don't use toString()
          break;
        }
      }
    }

    excelData.push(excelRow);
  }

  const buffer = nodeXlsx.build([
    {
      name: "Sheet1",
      data: excelData,
    },
  ]);

  return buffer;
};
