const changeGroupAvatar = require("./changeGroupAvatar");

// Every tool here requires ceo/coo (action tools). As more domains are
// added in later phases, read-only tools usable by director/admin should
// be registered separately with a lower role requirement.
const TOOLS = [changeGroupAvatar];

module.exports = {
  definitions: TOOLS.map((tool) => tool.definition),
  handlers: Object.fromEntries(TOOLS.map((tool) => [tool.definition.name, tool.handler])),
};
