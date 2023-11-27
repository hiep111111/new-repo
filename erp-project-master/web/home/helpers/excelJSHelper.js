import ExcelJS from "exceljs";

import { COLUMN_MIN_WIDTH, COLUMN_MAX_WIDTH, HEADER_FONT_FORMAT, DEFAULT_SHEET_NAME } from "../constants/excelConstant";

// Reference: https://www.npmjs.com/package/exceljs

class Excel_Helper {
  constructor(columns) {
    this.workbook = new ExcelJS.Workbook();
    this.columns = columns || [];
  }

  // Reference: https://www.npmjs.com/package/exceljs#reading-xlsx

  async readFile(filePath) {
    // TODO: check file existed
    await this.workbook.xlsx.readFile(filePath);
  }

  async read(stream) {
    await this.workbook.xlsx.read(stream);
  }

  async load(buffer) {
    await this.workbook.xlsx.load(buffer);
  }

  // Reference: https://www.npmjs.com/package/exceljs#reading-csv

  async readCSVFile(filePath, options) {
    await this.workbook.csv.readFile(filePath, options);
  }

  async readCSV(streamOrBuffer, options) {
    await this.workbook.csv.read(streamOrBuffer, options);
  }

  async getWorkbookInstant() {
    return this.workbook;
  }

  async createDataSheet(data, sheetName = DEFAULT_SHEET_NAME) {
    const worksheet = this.workbook.addWorksheet(sheetName);
    const columnsFormat = this.columns || [];

    if (!columnsFormat) {
      if (data[0]) {
        Object.keys(data[0]).forEach((field) => {
          // TODO: i18 translation
          // Reference: https://gitlab.com/bos-microservices/core/-/blob/master/helpers/excelHelper.js

          columnsFormat.push({
            header: field,
            key: field,
          });
        });
      }
    }

    if (this.autoFormatting) {
      columnsFormat.forEach((column) => {
        const columnLength = column.header.length;

        column.width = columnLength < COLUMN_MIN_WIDTH ? COLUMN_MIN_WIDTH : Math.min(COLUMN_MAX_WIDTH, columnLength);
      });

      worksheet.getRow(1).font = HEADER_FONT_FORMAT;
    }

    worksheet.columns = columnsFormat;

    worksheet.addRows(data);

    return worksheet;
  }

  // Reference: https://www.npmjs.com/package/exceljs#writing-xlsx

  async writeFile(filePath) {
    return await this.workbook.xlsx.writeFile(filePath);
  }

  async write(stream) {
    return await this.workbook.xlsx.write(stream);
  }

  async writeBuffer() {
    return await this.workbook.xlsx.writeBuffer();
  }

  // Reference: https://www.npmjs.com/package/exceljs#writing-csv

  async writeCSVFile(filePath) {
    return await this.workbook.csv.writeFile(filePath);
  }

  async writeCSVStream(stream) {
    return await this.workbook.csv.write(stream);
  }

  // TODO: add manual data manipulation
  // [..] Formula, Tabling, Formatting Reference: https://www.brcline.com/blog/how-to-write-an-excel-file-in-nodejs
}

export default Excel_Helper;
