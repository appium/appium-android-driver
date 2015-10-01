import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { AndroidDriver } from '../..';
import sampleApps from 'sample-apps';

chai.should();
chai.use(chaiAsPromised);

let driver, caps;
let defaultCaps = {
  app: sampleApps('ApiDemos-debug'),
  deviceName: 'Android',
  platformName: 'Android'
};

describe('touch - performTouch', function () {
  before(async () => {
    driver = new AndroidDriver();
    caps = Object.assign({}, defaultCaps);
    caps.appActivity = '.view.DragAndDropDemo';
    await driver.createSession(caps);
  });
  afterEach(async () => {
    await driver.reset();
  });
  it('should drag by element', async () => {
    let startEle = await driver.findElement("id", "io.appium.android.apis:id/drag_dot_3");
    let endEle = await driver.findElement("id", "io.appium.android.apis:id/drag_dot_2");
    let gestures = [{"action": "longPress", "options": {"element": startEle.ELEMENT}},
                    {"action": "moveTo", "options": {"element": endEle.ELEMENT}},
                    {"action": "release", "options": {}}];
    await driver.performTouch(gestures);
    let resultEle = await driver.findElement("id","io.appium.android.apis:id/drag_result_text");
    await driver.getText(resultEle.ELEMENT).should.eventually.equal("Dropped!");
  });
  it('should drag by element by offset', async () => {
    let startEle = await driver.findElement("id", "io.appium.android.apis:id/drag_dot_3");
    let endEle = await driver.findElement("id", "io.appium.android.apis:id/drag_dot_2");
    let gestures = [{"action": "longPress",
                     "options": {"element": startEle.ELEMENT, "x": 5, "y": 5}},
                    {"action": "moveTo", "options":
                    {"element": endEle.ELEMENT, "x": 5, "y": 5}},
                    {"action": "release","options":{}}];
    await driver.performTouch(gestures);
    let element3 = await driver.findElement("id","io.appium.android.apis:id/drag_result_text");
    await driver.getText(element3.ELEMENT).should.eventually.equal("Dropped!");
  });
  it('should drag by absolute position', async () => {
    let startEle = await driver.findElement("id", "io.appium.android.apis:id/drag_dot_3");
    let startLoc = await driver.getLocationInView(startEle.ELEMENT);
    let startSize = await driver.getSize(startEle.ELEMENT);
    let endEle = await driver.findElement("id", "io.appium.android.apis:id/drag_dot_2");
    let endLoc = await driver.getLocationInView(endEle.ELEMENT);
    let endSize = await driver.getSize(endEle.ELEMENT);
    let gestures = [{"action": "longPress",
                     "options": {"x": startLoc.x + (startSize.width / 2),
                                 "y": startLoc.y + (startSize.height / 2)}},
                    {"action": "moveTo",
                     "options": {"x": endLoc.x + (endSize.width / 2),
                                 "y": endLoc.y + (endSize.height / 2)}},
                    {"action": "release","options":{}}];
    await driver.performTouch(gestures);
    let resultEle = await driver.findElement("id","io.appium.android.apis:id/drag_result_text");
    await driver.getText(resultEle.ELEMENT).should.eventually.equal("Dropped!");
  });
});
