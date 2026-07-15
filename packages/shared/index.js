module.exports = {
  ...require("./db"),
  ...require("./jobs"),
  ...require("./logger"),
  telegram: require("./telegram"),
  i18n: require("./i18n"),
};
