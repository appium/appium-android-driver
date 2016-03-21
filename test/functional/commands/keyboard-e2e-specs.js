import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import _ from 'lodash';
import sampleApps from 'sample-apps';
import AndroidDriver from '../../..';


chai.should();
chai.use(chaiAsPromised);

let defaultAsciiCaps = {
  app: sampleApps('ApiDemos-debug'),
  deviceName: 'Android',
  platformName: 'Android',
  newCommandTimeout: 90
};

let defaultUnicodeCaps = _.defaults({
  unicodeKeyboard: true,
  resetKeyboard: true
}, defaultAsciiCaps);

function deSamsungify (text) {
  // For samsung S5 text is appended with ". Editing."
  return text.replace(". Editing.", "");
}

async function runTextEditTest (driver, testText, keys = false) {
  let el = _.last(await driver.findElOrEls('class name', 'android.widget.EditText', true));
  el = el.ELEMENT;
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

async function runCombinationKeyEventTest (driver) {
  await driver.pressKeyCode(29, 193);

  let el = _.last(await driver.findElOrEls('class name', 'android.widget.TextView', true));
  el = el.ELEMENT;
  let text = await driver.getText(el);
  text.should.include('keyCode=KEYCODE_A');
  text.should.include('metaState=META_SHIFT_ON');
}

async function runKeyEventTest (driver) {
  await driver.pressKeyCode(82);

  let el = _.last(await driver.findElOrEls('class name', 'android.widget.TextView', true));
  el = el.ELEMENT;
  let text = await driver.getText(el);
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

let unicodeTests = _.union(tests, [
  { label: 'should be able to send \'-\' in unicode text', text: 'परीक्षा-परीक्षण' },
  { label: 'should be able to send \'&\' in text', text: 'Fish & chips' },
  { label: 'should be able to send \'&\' in unicode text', text: 'Mīna & chips' },
  { label: 'should be able to send roman characters with diacritics', text: 'Áé Œ ù ḍ' },
  { label: 'should be able to send a \'u\' with an umlaut', text: 'ü' },
]);

let languageTests = [
  { label: 'should be able to send Tamil', text: 'சோதனை' },
  { label: 'should be able to send Gujarati', text: 'પરીક્ષણ' },
  { label: 'should be able to send Chinese', text: '测试' },
  { label: 'should be able to send Russian', text: 'тестирование' },
  // skip rtl languages, which don't clear correctly atm
  // { label: 'should be able to send Arabic', 'تجريب'],
  // { label: 'should be able to send Hebrew', 'בדיקות'],
];

describe('keyboard', () => {
  describe('ascii', () => {
    let driver;
    before(async () => {
      driver = new AndroidDriver();
      await driver.createSession(defaultAsciiCaps);

      // sometimes the default ime is not what we are using
      let engines = await driver.availableIMEEngines();
      await driver.activateIMEEngine(_.first(engines));
      console.log(engines);
    });
    after(async () => {
      await driver.deleteSession();
    });

    describe('editing a text field', () => {
      beforeEach(async () => {
        await driver.startActivity('io.appium.android.apis', '.view.TextFields');
      });

      for (let test of tests) {
        describe(test.label, () => {
          it('should work with setValue', async () => {
            await runTextEditTest(driver, test.text);
          });
          it('should work with keys', async () => {
            await runTextEditTest(driver, test.text, true);
          });
        });
      }
    });

    describe('sending a key event', () => {
      beforeEach(async () => {
        await driver.startActivity('io.appium.android.apis', '.text.KeyEventText');
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
      beforeEach(async () => {
        await driver.startActivity('io.appium.android.apis', '.view.TextFields');
      });

      for (let testSet of [tests, unicodeTests, languageTests]) {
        for (let test of testSet) {
          describe(test.label, () => {
            it('should work with setValue', async () => {
              await runTextEditTest(driver, test.text);
            });
            it('should work with keys', async () => {
              await runTextEditTest(driver, test.text, true);
            });
          });
        }
      }
    });

    describe('sending a key event', () => {
      beforeEach(async () => {
        await driver.startActivity('io.appium.android.apis', '.text.KeyEventText');
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
