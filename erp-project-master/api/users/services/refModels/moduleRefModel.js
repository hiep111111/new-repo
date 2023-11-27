import { DATA_TYPE } from "../../constants/dataTypeConstant";

const refModel = {
  moduleId: {
    type: DATA_TYPE.ID,
    refModelName: "modules",
    refKeyField: "_id",
    relatedFields: ["moduleCode", "moduleName", "moduleOrder"],
  },

  moduleCode: {
    type: DATA_TYPE.STRING,
    index: true,
    required: true,
  },

  moduleName: {
    type: DATA_TYPE.STRING,
    index: true,
    required: true,
  },

  moduleOrder: { type: DATA_TYPE.NUMBER },
};

export default refModel;
