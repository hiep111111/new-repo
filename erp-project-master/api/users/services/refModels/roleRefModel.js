import { DATA_TYPE } from "../../constants/dataTypeConstant";
import functionWithParentRefModel from "./functionWithParentRefModel";

const refModel = {
  roleId: {
    type: DATA_TYPE.ID,
    refModelName: "roles",
    refKeyField: "_id",
    relatedFields: ["roleCode", "roleName", "functionList"],
  },

  roleCode: { type: DATA_TYPE.STRING },
  roleName: { type: DATA_TYPE.STRING },

  functionList: [
    {
      ...functionWithParentRefModel,
    },
  ],
};

export default refModel;
