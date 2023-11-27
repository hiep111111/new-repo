import { DATA_TYPE } from "../../constants/dataTypeConstant";
import moduleRefModel from "../refModels/moduleRefModel";

const refModel = {
  functionId: {
    type: DATA_TYPE.ID,
    refModelName: "functions",
    refKeyField: "_id",
    relatedFields: [
      "functionUrl",
      "functionName",
      "functionOrder",
      "moduleId",
      "moduleCode",
      "moduleName",
      "moduleOrder",
      "functionActionList",
      { fromField: "parentId", toField: "functionParentId" },
      { fromField: "parentUrl", toField: "functionParentUrl" },
      { fromField: "parentName", toField: "functionParentName" },
    ],
  },

  functionUrl: { type: DATA_TYPE.STRING },
  functionName: { type: DATA_TYPE.STRING },
  functionOrder: { type: DATA_TYPE.NUMBER },

  functionParentId: {
    type: DATA_TYPE.ID,
    refModelName: "functions",
    refKeyField: "_id",
    relatedFields: [
      { fromField: "functionUrl", toField: "functionParentUrl" },
      { fromField: "functionName", toField: "functionParentName" },
      "moduleId",
      "moduleCode",
      "moduleName",
      "moduleOrder", // follow parent module config
    ],
  },

  functionParentUrl: { type: DATA_TYPE.STRING },
  functionParentName: { type: DATA_TYPE.STRING },

  ...moduleRefModel,

  functionActionList: { type: DATA_TYPE.STRING },
};

export default refModel;
