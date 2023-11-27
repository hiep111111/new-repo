import { DATA_TYPE } from "../../constants/dataTypeConstant";

const model = {
  modelName: "sysSequences",

  data: {
    model: {
      type: DATA_TYPE.STRING,
      unique: true,
      required: true,
      index: true,
    },

    nextValue: {
      type: DATA_TYPE.NUMBER,
      required: true,
      defaultValue: 1,
    },
  },

  apiList: [],
};

export default model;
