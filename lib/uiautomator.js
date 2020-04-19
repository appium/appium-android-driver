import events from 'events';
import { logger } from 'appium-support';


const log = logger.getLogger('UiAutomator');

class UiAutomator extends events.EventEmitter {
  constructor (adb) {
    if (!adb) {
      log.errorAndThrow('adb is required to instantiate UiAutomator');
    }
    super();
    this.adb = adb;
    this.tempPath = '/data/local/tmp/';
  }

  async start (uiAutomatorBinaryPath, className, startDetector, ...extraParams) {
    let processIsAlive;
    try {
      log.debug('Starting UiAutomator');
      this.changeState(UiAutomator.STATE_STARTING);

      log.debug('Parsing uiautomator jar');
      // expecting a path like /ads/ads/foo.jar or \asd\asd\foo.jar
      let jarName = this.parseJarNameFromPath(uiAutomatorBinaryPath);
      await this.adb.push(uiAutomatorBinaryPath, this.tempPath);

      // killing any uiautomator existing processes
      await this.killUiAutomatorOnDevice();

      log.debug('Starting UIAutomator');
      let args = ['shell', 'uiautomator', 'runtest', jarName, '-c', className, ...extraParams];
      this.proc = this.adb.createSubProcess(args);

      // handle out-of-bound exit by simply emitting a stopped state
      this.proc.on('exit', (code, signal) => {
        processIsAlive = false;
        // cleanup
        if (this.state !== UiAutomator.STATE_STOPPED &&
            this.state !== UiAutomator.STATE_STOPPING) {
          let msg = `UiAutomator exited unexpectedly with code ${code}, ` +
                    `signal ${signal}`;
          log.error(msg);
        } else if (this.state === UiAutomator.STATE_STOPPING) {
          log.debug('UiAutomator shut down normally');
        }
        this.changeState(UiAutomator.STATE_STOPPED);
      });

      await this.proc.start(startDetector);
      processIsAlive = true;
      this.changeState(UiAutomator.STATE_ONLINE);
      return this.proc;
    } catch (e) {
      this.emit(UiAutomator.EVENT_ERROR, e);
      if (processIsAlive) {
        await this.killUiAutomatorOnDevice();
        await this.proc.stop();
      }
      log.errorAndThrow(e);
    }
  }

  async shutdown () {
    log.debug('Shutting down UiAutomator');
    if (this.state !== UiAutomator.STATE_STOPPED) {
      this.changeState(UiAutomator.STATE_STOPPING);
      await this.proc.stop();
    }
    await this.killUiAutomatorOnDevice();
    this.changeState(UiAutomator.STATE_STOPPED);
  }

  parseJarNameFromPath (binaryPath) {
    let reTest = /.*(\/|\\)(.*\.jar)/.exec(binaryPath);
    if (!reTest) {
      throw new Error(`Unable to parse jar name from ${binaryPath}`);
    }
    let jarName = reTest[2];
    log.debug(`Found jar name: '${jarName}'`);
    return jarName;
  }

  changeState (state) {
    log.debug(`Moving to state '${state}'`);
    this.state = state;
    this.emit(UiAutomator.EVENT_CHANGED, {state});
  }

  async killUiAutomatorOnDevice () {
    try {
      await this.adb.killProcessesByName('uiautomator');
    } catch (e) {
      log.warn(`Error while killing uiAutomator: ${e}`);
    }
  }

}

UiAutomator.EVENT_ERROR = 'uiautomator_error';
UiAutomator.EVENT_CHANGED = 'stateChanged';
UiAutomator.STATE_STOPPING = 'stopping';
UiAutomator.STATE_STOPPED = 'stopped';
UiAutomator.STATE_STARTING = 'starting';
UiAutomator.STATE_ONLINE = 'online';


export { UiAutomator };
export default UiAutomator;
