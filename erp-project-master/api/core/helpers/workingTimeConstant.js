import { TOKEN } from "../helpers/commonHelper";

export const YEAR_OPTION_LIST = [
  { text: "2021", value: 2021 },
  { text: "2020", value: 2020 },
  { text: "2019", value: 2019 },
  { text: "2018", value: 2018 },
  { text: "Chọn giá trị ...", value: "" },
];

export const START_MORNING_OPTION_LIST = [
  { text: "7h00", value: 420 },
  { text: "7h30", value: 450 },
  { text: "8h00", value: 480 },
  { text: "8h30", value: 510 },
  { text: "9h00", value: 540 },
  { text: "Chọn giá trị ...", value: "" },
];

export const END_MORNING_OPTION_LIST = [
  { text: "11h00", value: 660 },
  { text: "11h30", value: 690 },
  { text: "12h00", value: 720 },
  { text: "12h30", value: 750 },
  { text: "13h00", value: 780 },
  { text: "Chọn giá trị ...", value: "" },
];

export const START_AFTERNOON_OPTION_LIST = [
  { text: "12h00", value: 720 },
  { text: "12h30", value: 750 },
  { text: "13h00", value: 780 },
  { text: "13h30", value: 810 },
  { text: "14h00", value: 840 },
  { text: "Chọn giá trị ...", value: "" },
];

export const END_AFTERNOON_OPTION_LIST = [
  { text: "16h00", value: 960 },
  { text: "16h30", value: 990 },
  { text: "17h00", value: 1120 },
  { text: "17h30", value: 1150 },
  { text: "18h00", value: 1180 },
  { text: "Chọn giá trị ...", value: "" },
];

export const DAY_OF_WEEK_OPTION_LIST = [
  { text: "Thứ 2", value: 1 },
  { text: "Thứ 3", value: 2 },
  { text: "Thứ 4", value: 3 },
  { text: "Thứ 5", value: 4 },
  { text: "Thứ 6", value: 5 },
  { text: "Thứ 7", value: 6 },
  { text: "Chủ nhật", value: 0 },
  { text: "Chọn giá trị ...", value: "" },
];

export const HOLIDAY_TYPE = 4;
export const DAY_OFF_TYPE = 1;
export const MORNING_OFF_TYPE = 2;
export const AFTERNOON_OFF_TYPE = 3;

export const DAY_OFF_TYPE_OPTION_LIST = [
  { text: "Nghỉ cả ngày", value: DAY_OFF_TYPE },
  { text: "Nghỉ sáng", value: MORNING_OFF_TYPE },
  { text: "Nghỉ chiều", value: AFTERNOON_OFF_TYPE },
  { text: "Chọn giá trị ...", value: "" },
];

export const NUMBER_PATTERN = `WT${TOKEN.YEAR}${TOKEN.MONTH}${TOKEN.DAY}${TOKEN.SEPARATOR}${TOKEN.SEQUENCE}`;
export const NUMBER_LENGTH = 3;
