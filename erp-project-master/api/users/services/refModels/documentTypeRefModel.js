import { DATA_TYPE } from "../../constants/dataTypeConstant";

const refModel = {
  documentTypeId: {
    type: DATA_TYPE.ID,
    required: true,
    index: true,
    refModelName: "documentTypes",
    refKeyField: "_id",
    relatedFields: ["documentTypeCode", "documentTypeName"],
  },

  documentTypeCode: {
    type: DATA_TYPE.STRING,
    required: true,
    index: true,
  },

  documentTypeName: {
    type: DATA_TYPE.STRING,
    required: true,
  },
};

export default refModel;
