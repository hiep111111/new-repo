import { registerModelList, patchMissingSubDocument } from "../../helpers/modelHelper";

const refModelList = [
  require("./sysSequenceModel"), // number planing model
  require("./messageModel"),
];

registerModelList(refModelList, false); // [!] register to READONLY & NOT HANDLE service bus events

const serviceModelList = [
  // maintain
  require("./sysUserFeatureModel"),
  require("./sysAccessListModel"),
  require("./sysServiceBusEventModel"),
  require("./sysPolicyModel"),

  // auth
  require("./applicationModel"),
  require("./moduleModel"),
  require("./functionModel"),
  require("./roleModel"),
  require("./serviceModel"),

  require("./userModel"),
  require("./userLoggingModel"),
];

export const crossModelDataConstraint = registerModelList(serviceModelList);
// patchMissingSubDocument(crossModelDataConstraint); [!] don't delete this line, will uncomment to patch data

export default serviceModelList;
