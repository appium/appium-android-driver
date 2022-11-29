import findCmds from './find';
import generalCmds from './general';
import alertCmds from './alert';
import elementCmds from './element';
import contextCmds from './context';
import actionCmds from './actions';
import touchCmds from './touch';
import imeCmds from './ime';
import networkCmds from './network';
import coverageCmds from './coverage';
import recordscreenCmds from './recordscreen';
import screenStreamCmds from './streamscreen';
import performanceCmds from './performance';
import executeCmds from './execute';
import shellCmds from './shell';
import emuConsoleCmds from './emu-console';
import fileActionsCmds from './file-actions';
import appManagementCmds from './app-management';
import intentCmds from './intent';
import systemBarsCmds from './system-bars';
import logCmds from './log';
import mediaProjectionCmds from './media-projection';
import permissionsCommands from './permissions';


let commands = {};
Object.assign(
  commands,
  findCmds,
  generalCmds,
  alertCmds,
  elementCmds,
  contextCmds,
  actionCmds,
  touchCmds,
  imeCmds,
  networkCmds,
  coverageCmds,
  recordscreenCmds,
  intentCmds,
  screenStreamCmds,
  performanceCmds,
  executeCmds,
  shellCmds,
  emuConsoleCmds,
  systemBarsCmds,
  appManagementCmds,
  fileActionsCmds,
  logCmds,
  mediaProjectionCmds,
  permissionsCommands,
  // add other command types here
);

export { commands };
export default commands;
