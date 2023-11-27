import handlebars from "handlebars";
import fs from "fs-extra";
import path from "path";
import { isArray } from "lodash";

import { HELPER_TYPE, dateFormat, dateTimeFormat, numberFormat, booleanFormat, indexFormat, translateFormat } from "./businessHelper";

export const TEMPLATE_FOLDER = "services/templates";

export const handlebarString = async (template, data) => {
  return await handlebars.compile(template)(data);
};

export const templateRender = async (printingTemplate, data, helperList) => {
  const filePath = path.join(process.cwd(), TEMPLATE_FOLDER, `${printingTemplate}.hbs`);
  const template = await fs.readFile(filePath, "utf-8");

  if (!template) {
    throw new BosError(`Template file ${printingTemplate} is not found.`, BOS_ERROR.NOT_FOUND, HTTP_RESPONSE_CODE.NOT_FOUND);
  }

  handlebars.registerHelper("DATE", dateFormat);
  handlebars.registerHelper("DATE_TIME", dateTimeFormat);
  handlebars.registerHelper("NUMBER", numberFormat);
  handlebars.registerHelper("INDEX", indexFormat);
  handlebars.registerHelper("BOOLEAN", booleanFormat);
  handlebars.registerHelper("TRANSLATE", translateFormat);

  // TODO: translate i18n format

  if (isArray(helperList)) {
    helperList.forEach((func) => {
      const { name, type, helper } = func;

      if (type === HELPER_TYPE.HANDLEBARS_HELPER) {
        handlebars.registerHelper(name, helper);
      } else if (type === HELPER_TYPE.HANDLEBARS_PARTIAL) {
        handlebars.registerPartial(name, helper);
      }
    });
  }

  return await handlebars.compile(template)(data);
};

export const templateConfig = async (printingTemplate) => {
  const filePath = path.join(process.cwd(), TEMPLATE_FOLDER, `${printingTemplate}.json`);
  let templateConfig = {};

  if (fs.existsSync(filePath)) {
    const rawData = await fs.readFile(filePath, "utf-8");

    if (rawData) {
      templateConfig = JSON.parse(rawData);
    }
  }

  return templateConfig;
};
