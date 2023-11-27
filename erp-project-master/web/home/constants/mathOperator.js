import { convertToOptionList } from "../helpers/commonHelper";

const EQ = "$eq";
const NE = "$ne";

const GT = "$gt";
const GTE = "$gte";

const LT = "$lt";
const LTE = "$lte";

const IN = "$in";
const NOT_IN = "$nin";
const EXISTS = "$exists";

export const SET_OPERATOR = {
  IN,
  NOT_IN,
  EXISTS,
};

export const LOGIC_OPERATOR = {
  EQ,
  NE,
  GT,
  GTE,
  LT,
  LTE,
};

export const SET_OPERATOR_LIST = convertToOptionList(SET_OPERATOR);

export const LOGIC_OPERATOR_LIST = convertToOptionList(LOGIC_OPERATOR);

export const OPERATOR = {
  EQ,
  NE,
  GT,
  GTE,
  LT,
  LTE,
  EXISTS,
  IN,
  NOT_IN,
};

export const OPERATOR_LIST = convertToOptionList({ ...SET_OPERATOR, ...LOGIC_OPERATOR });
