exports.default = async function (configuration) {
  console.log("Custom sign hook: skipping signature for path", configuration.path);
};
