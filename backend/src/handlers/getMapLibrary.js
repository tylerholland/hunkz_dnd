const { ok } = require("../lib/response");
const { getMapLibraryState } = require("../lib/specialRecords");

exports.handler = async () => {
  return ok(await getMapLibraryState());
};
