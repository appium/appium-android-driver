import actionCmds from './actions';
import alertCmds from './alert';
import appManagementCmds from './app-management';
import contextCmds from './context';
import elementCmds from './element';
import emuConsoleCmds from './emu-console';
import executeCmds from './execute';
import fileActionsCmds from './file-actions';
import findCmds from './find';
import generalCmds from './general';
import imeCmds from './ime';
import intentCmds from './intent';
import keyboardCmds from './keyboard';
import logCmds from './log';
import mediaProjectionCmds from './media-projection';
import networkCmds from './network';
import performanceCmds from './performance';
import permissionsCmds from './permissions';
import recordscreenCmds from './recordscreen';
import shellCmds from './shell';
import screenStreamCmds from './streamscreen';
import systemBarsCmds from './system-bars';
import touchCmds from './touch';

const commands = {
  findCmds,
  generalCmds,
  alertCmds,
  elementCmds,
  contextCmds,
  actionCmds,
  touchCmds,
  imeCmds,
  networkCmds,
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
  permissionsCmds,
  keyboardCmds,
  // add other command types here
};

export {commands};

export type * from './mixins';
