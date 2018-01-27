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
import performanceCmds from './performance';
import executeCmds from "./execute";
import shellCmds from "./shell";
import appManagementCommands from './apps-management';

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
  performanceCmds,
  executeCmds,
  shellCmds,
  appManagementCommands,
  // add other command types here
);

export default commands;
