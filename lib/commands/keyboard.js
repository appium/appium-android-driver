const commands = {};

commands.hideKeyboard = async function hideKeyboard () {
  return await this.adb.hideKeyboard();
};

commands.isKeyboardShown = async function isKeyboardShown () {
  const {isKeyboardShown} = await this.adb.isSoftKeyboardPresent();
  return isKeyboardShown;
};

export default commands;
