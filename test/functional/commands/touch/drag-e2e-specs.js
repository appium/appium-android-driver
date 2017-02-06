import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import _ from 'lodash';
import AndroidDriver from '../../../..';
import DEFAULT_CAPS from '../../desired';


chai.should();
chai.use(chaiAsPromised);

let caps = _.defaults({
  appPackage: 'io.appium.android.apis',
  appActivity: '.view.DragAndDropDemo'
}, DEFAULT_CAPS);

describe('apidemo - touch', function () {
  let driver;
  before(async () => {
    driver = new AndroidDriver();
    await driver.createSession(caps);
  });
  after(async () => {
    await driver.deleteSession();
  });
  afterEach(async () => {
    // reset the view by restarting the activity
    await driver.startActivity(caps.appPackage, caps.appActivity);
  });
  describe('drag', function () {
    it('should drag by element', async () => {
      let dot3 = await driver.findElOrEls('id', 'io.appium.android.apis:id/drag_dot_3', false);
      let dot2 = await driver.findElOrEls('id', 'io.appium.android.apis:id/drag_dot_2', false);
      let gestures = [
        {options: {element: dot3.ELEMENT}},
        {options: {element: dot2.ELEMENT}}
      ];
      await driver.doTouchDrag(gestures);

      let results = await driver.findElOrEls('id', 'io.appium.android.apis:id/drag_result_text', false);
      await driver.getText(results.ELEMENT).should.eventually.include('Dropped');
    });
    it('should drag by element with an offset', async () => {
      let dot3 = await driver.findElOrEls('id', 'io.appium.android.apis:id/drag_dot_3', false);
      let dot2 = await driver.findElOrEls('id', 'io.appium.android.apis:id/drag_dot_2', false);
      let gestures = [
        {options: {element: dot3.ELEMENT, x: 5, y: 5}},
        {options: {element: dot2.ELEMENT, x: 5, y: 5}}
      ];
      await driver.doTouchDrag(gestures);
      let results = await driver.findElOrEls('id', 'io.appium.android.apis:id/drag_result_text', false);
      await driver.getText(results.ELEMENT).should.eventually.include('Dropped');
    });
  });
  describe('performTouch', function () {
    it('should drag by element', async () => {
      let startEle = await driver.findElement("id", "io.appium.android.apis:id/drag_dot_3");
      let endEle = await driver.findElement("id", "io.appium.android.apis:id/drag_dot_2");
      let gestures = [{"action": "longPress", "options": {"element": startEle.ELEMENT}},
                      {"action": "moveTo", "options": {"element": endEle.ELEMENT}},
                      {"action": "release", "options": {}}];
      await driver.performTouch(gestures);
      let resultEle = await driver.findElement("id", "io.appium.android.apis:id/drag_result_text");
      await driver.getText(resultEle.ELEMENT).should.eventually.equal("Dropped!");
    });
    it('should drag by element by offset', async () => {
      let startEle = await driver.findElement("id", "io.appium.android.apis:id/drag_dot_3");
      let endEle = await driver.findElement("id", "io.appium.android.apis:id/drag_dot_2");
      let gestures = [{"action": "longPress",
                       "options": {"element": startEle.ELEMENT, "x": 5, "y": 5}},
                      {"action": "moveTo", "options":
                      {"element": endEle.ELEMENT, "x": 5, "y": 5}},
                      {"action": "release", "options":{}}];
      await driver.performTouch(gestures);
      let element3 = await driver.findElement("id", "io.appium.android.apis:id/drag_result_text");
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
                      {"action": "release", "options":{}}];
      await driver.performTouch(gestures);
      let resultEle = await driver.findElement("id", "io.appium.android.apis:id/drag_result_text");
      await driver.getText(resultEle.ELEMENT).should.eventually.equal("Dropped!");
    });
  });
});
