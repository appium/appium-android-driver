import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import _ from 'lodash';
import { retryInterval } from 'asyncbox';
import AndroidDriver from '../../..';
import B from 'bluebird';
import DEFAULT_CAPS from '../desired';


chai.should();
chai.use(chaiAsPromised);

const BUTTON_CLASS = 'android.widget.Button';
const EDITTEXT_CLASS = 'android.widget.EditText';
const TEXTVIEW_CLASS = 'android.widget.TextView';

const PACKAGE = 'io.appium.android.apis';
const TEXTFIELD_ACTIVITY = '.view.TextFields';
const KEYEVENT_ACTIVITY = '.text.KeyEventText';

let defaultAsciiCaps = _.defaults({
  newCommandTimeout: 90,
  appPackage: PACKAGE,
  appActivity: TEXTFIELD_ACTIVITY
}, DEFAULT_CAPS);

let defaultUnicodeCaps = _.defaults({
  unicodeKeyboard: true,
  resetKeyboard: true
}, defaultAsciiCaps);

function deSamsungify (text) {
  // For samsung S5 text is appended with ". Editing."
  return text.replace(". Editing.", "");
}

async function getElement (driver, className) {
  return await retryInterval(10, 1000, async () => {
    let el = _.last(await driver.findElOrEls('class name', className, true));
    return el.ELEMENT;
  });
}

async function runTextEditTest (driver, testText, keys = false) {
  let el = await getElement(driver, EDITTEXT_CLASS);
  await driver.clear(el);

  if (keys) {
    await driver.keys([testText]);
  } else {
    await driver.setValue(testText, el);
  }

  let text = await driver.getText(el);
  deSamsungify(text).should.be.equal(testText);

  return el;
}

/*
 * The key event page needs to be cleared between runs, or else we get false
 * positives from previously run tests. The page has a single button that
 * removes all text from within the main TextView.
 */
async function clearKeyEvents (driver) {
  let el = await getElement(driver, BUTTON_CLASS);
  driver.click(el);

  // wait a moment for the clearing to occur, lest we too quickly try to enter more text
  await B.delay(500);
}

async function runCombinationKeyEventTest (driver) {
  let runTest = async function () {
    await driver.pressKeyCode(29, 193);
    let el = await getElement(driver, TEXTVIEW_CLASS);
    return await driver.getText(el);
  };

  await clearKeyEvents(driver);

  let text = await runTest();
  if (text === '') {
    // the test is flakey... try again
    text = await runTest();
  }
  text.should.include('keyCode=KEYCODE_A');
  text.should.include('metaState=META_SHIFT_ON');
}

async function runKeyEventTest (driver) {
  let runTest = async function () {
    await driver.pressKeyCode(82);
    let el = await getElement(driver, TEXTVIEW_CLASS);
    return await driver.getText(el);
  };

  await clearKeyEvents(driver);

  let text = await runTest();
  if (text === '') {
    // the test is flakey... try again
    text = await runTest();
  }
  text.should.include('[keycode=82]');
  text.should.include('keyCode=KEYCODE_MENU');
}

let tests = [
  { label: 'editing a text field', text: 'Life, the Universe and Everything.' },
  { label: 'sending \'&-\'', text: '&-' },
  { label: 'sending \'&\' and \'-\' in other text', text: 'In the mid-1990s he ate fish & chips as mayor-elect.' },
  { label: 'sending \'-\' in text', text: 'Super-test.' },
  { label: 'sending numbers', text: '0123456789'},
];

let unicodeTests = [
  { label: 'should be able to send \'-\' in unicode text', text: 'परीक्षा-परीक्षण' },
  { label: 'should be able to send \'&\' in text', text: 'Fish & chips' },
  { label: 'should be able to send \'&\' in unicode text', text: 'Mīna & chips' },
  { label: 'should be able to send roman characters with diacritics', text: 'Áé Œ ù ḍ' },
  { label: 'should be able to send a \'u\' with an umlaut', text: 'ü' },
];

let languageTests = [
  { label: 'should be able to send Tamil', text: 'சோதனை' },
  { label: 'should be able to send Gujarati', text: 'પરીક્ષણ' },
  { label: 'should be able to send Chinese', text: '测试' },
  { label: 'should be able to send Russian', text: 'тестирование' },
  { label: 'should be able to send Arabic', text: 'تجريب' },
  { label: 'should be able to send Hebrew', text: 'בדיקות' },
];

describe('keyboard', () => {
  describe('ascii', () => {
    let driver;
    before(async () => {
      driver = new AndroidDriver();
      await driver.createSession(defaultAsciiCaps);

      // sometimes the default ime is not what we are using
      let engines = await driver.availableIMEEngines();
      let selectedEngine = _.first(engines);
      for (let engine of engines) {
        // it seems that the latin ime has `android.inputmethod` in its package name
        if (engine.indexOf('android.inputmethod') !== -1) {
          selectedEngine = engine;
        }
      }
      await driver.activateIMEEngine(selectedEngine);
    });
    after(async () => {
      await driver.deleteSession();
    });

    describe('editing a text field', () => {
      before(async () => {
        await driver.startActivity(PACKAGE, TEXTFIELD_ACTIVITY);
      });

      for (let test of tests) {
        describe(test.label, () => {
          it(`should work with setValue: '${test.text}'`, async () => {
            await runTextEditTest(driver, test.text);
          });
          it(`should work with keys: '${test.text}'`, async () => {
            await runTextEditTest(driver, test.text, true);
          });
        });
      }

      it('should be able to clear a password field', async () => {
        // there is currently no way to assert anything about the contents
        // of a password field, since there is no way to access the contents
        // but this should, at the very least, not fail
        let els = await driver.findElOrEls('class name', EDITTEXT_CLASS, true);
        let el = els[1].ELEMENT;

        await driver.setValue('super-duper password', el);
        await driver.clear(el);
      });
    });

    describe('sending a key event', () => {
      before(async () => {
        await driver.startActivity(PACKAGE, KEYEVENT_ACTIVITY);
        await B.delay(500);
      });

      it('should be able to send combination keyevents', async () => {
        await runCombinationKeyEventTest(driver);
      });
      it('should be able to send keyevents', async () => {
        await runKeyEventTest(driver);
      });
    });
  });

  describe('unicode', () => {
    let driver;
    before(async () => {
      driver = new AndroidDriver();
      await driver.createSession(defaultUnicodeCaps);
    });
    after(async () => {
      await driver.deleteSession();
    });

    describe('editing a text field', () => {
      before(async () => {
        await driver.startActivity(PACKAGE, TEXTFIELD_ACTIVITY);
      });

      for (let testSet of [tests, unicodeTests, languageTests]) {
        for (let test of testSet) {
          describe(test.label, () => {
            it(`should work with setValue: '${test.text}'`, async () => {
              await runTextEditTest(driver, test.text);
            });
            it(`should work with keys: '${test.text}'`, async () => {
              await runTextEditTest(driver, test.text, true);
            });
          });
        }
      }
    });

    describe('sending a key event', () => {
      before(async () => {
        await driver.startActivity(PACKAGE, KEYEVENT_ACTIVITY);
      });

      it('should be able to send combination keyevents', async () => {
        await runCombinationKeyEventTest(driver);
      });
      it('should be able to send keyevents', async () => {
        await runKeyEventTest(driver);
      });
    });
  });
});
