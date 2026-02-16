import sinon from 'sinon';
import {DEVTOOLS_SOCKET_PATTERN} from '../../../lib/commands/context/helpers';
import * as webviewHelpers from '../../../lib/commands/context/helpers';
import {ADB} from 'appium-adb';
import {AndroidDriver} from '../../../lib/driver';
import {expect, use} from 'chai';
import chaiAsPromised from 'chai-as-promised';

use(chaiAsPromised);

const sandbox = sinon.createSandbox();

describe('Webview Helpers', function () {
  const adb = new ADB();
  let driver = new AndroidDriver();
  let stubbedShell: sinon.SinonStub;

  before(async function () {
    driver = new AndroidDriver();
    driver.adb = adb;
  });

  afterEach(function () {
    sandbox.restore();
  });

  describe('DEVTOOLS_SOCKET_PATTERN', function () {
    it('patting patterns with webview_devtools_remote_22138', function () {
      expect(DEVTOOLS_SOCKET_PATTERN.test('@webview_devtools_remote_22138')).to.be.true;
    });
    it('patting patterns with webview_devtools_remote_m6x_27719', function () {
      expect(DEVTOOLS_SOCKET_PATTERN.test('@webview_devtools_remote_m6x_27719')).to.be.true;
    });
    it('patting patterns with chrome_devtools_remote', function () {
      expect(DEVTOOLS_SOCKET_PATTERN.test('@chrome_devtools_remote')).to.be.true;
    });
  });

  describe('When the webviews are obtained', function () {
    describe('for an app that embeds Chromium', function () {
      let webViews;

      beforeEach(async function () {
        stubbedShell = sandbox.stub(adb, 'shell').callsFake(function () {
          return Promise.resolve(
            'Num       RefCount Protocol Flags    Type St Inode Path\n' +
              '0000000000000000: 00000002 00000000 00010000 0001 01  2818 /dev/socket/ss_conn_daemon\n' +
              '0000000000000000: 00000002 00000000 00010000 0001 01  9231 @mcdaemon\n' +
              '0000000000000000: 00000002 00000000 00010000 0001 01 245445 @webview_devtools_remote_123\n' +
              '0000000000000000: 00000002 00000000 00010000 0001 01  2826 /dev/socket/installd\n',
          );
        }) as sinon.SinonStub;
        const webviewsMapping = await webviewHelpers.getWebViewsMapping.bind(driver)({
          androidDeviceSocket: 'webview_devtools_remote_123',
          ensureWebviewsHavePages: false,
          enableWebviewDetailsCollection: false,
        });
        webViews = webviewHelpers.parseWebviewNames.bind(driver)(webviewsMapping, {
          ensureWebviewsHavePages: false,
        });
      });

      it('then the unix sockets are queried', function () {
        expect(stubbedShell.calledOnce).to.be.true;
        expect(stubbedShell.getCall(0).args[0]).to.deep.equal(['cat', '/proc/net/unix']);
      });

      it('then the webview is returned', function () {
        expect(webViews.length).to.equal(1);
        expect(webViews).to.deep.equal(['WEBVIEW_123']);
      });
    });

    describe('for a Chromium webview', function () {
      let webViews;

      beforeEach(async function () {
        stubbedShell = sandbox.stub(adb, 'shell').callsFake(function () {
          return (
            'Num       RefCount Protocol Flags    Type St Inode Path\n' +
            '0000000000000000: 00000002 00000000 00010000 0001 01  2818 /dev/socket/ss_conn_daemon\n' +
            '0000000000000000: 00000002 00000000 00010000 0001 01  9231 @mcdaemon\n' +
            '0000000000000000: 00000002 00000000 00010000 0001 01 245445 @chrome_devtools_remote\n' +
            '0000000000000000: 00000002 00000000 00010000 0001 01  2826 /dev/socket/installd\n'
          );
        });

        const webviewsMapping = await webviewHelpers.getWebViewsMapping.bind(driver)({
          androidDeviceSocket: 'chrome_devtools_remote',
          ensureWebviewsHavePages: false,
          enableWebviewDetailsCollection: false,
        });
        webViews = webviewHelpers.parseWebviewNames.bind(driver)(webviewsMapping, {
          ensureWebviewsHavePages: false,
        });
      });

      it('then the unix sockets are queried', function () {
        expect(stubbedShell.calledOnce).to.be.true;
        expect(stubbedShell.getCall(0).args[0]).to.deep.equal(['cat', '/proc/net/unix']);
      });

      it('then the webview is returned', function () {
        expect(webViews.length).to.equal(1);
        expect(webViews).to.deep.equal(['CHROMIUM']);
      });
    });

    describe('and no webviews exist', function () {
      let webViews;

      beforeEach(async function () {
        stubbedShell = sandbox.stub(adb, 'shell').callsFake(function () {
          return (
            'Num       RefCount Protocol Flags    Type St Inode Path\n' +
            '0000000000000000: 00000002 00000000 00010000 0001 01  2818 /dev/socket/ss_conn_daemon\n' +
            '0000000000000000: 00000002 00000000 00010000 0001 01  9231 @mcdaemon\n' +
            '0000000000000000: 00000002 00000000 00010000 0001 01  2826 /dev/socket/installd\n'
          );
        });

        const webviewsMapping = await webviewHelpers.getWebViewsMapping.bind(driver)();
        webViews = webviewHelpers.parseWebviewNames.bind(driver)(webviewsMapping, {
          ensureWebviewsHavePages: false,
          enableWebviewDetailsCollection: false,
        });
      });

      it('then the unix sockets are queried', function () {
        expect(stubbedShell.calledOnce).to.be.true;
        expect(stubbedShell.getCall(0).args[0]).to.deep.equal(['cat', '/proc/net/unix']);
      });

      it('then no webviews are returned', function () {
        expect(webViews.length).to.equal(0);
      });
    });

    describe('and crosswalk webviews exist', function () {
      let webViews;

      beforeEach(function () {
        stubbedShell = sandbox.stub(adb, 'shell').callsFake(function () {
          return (
            'Num       RefCount Protocol Flags    Type St Inode Path\n' +
            '0000000000000000: 00000002 00000000 00010000 0001 01  2818 /dev/socket/ss_conn_daemon\n' +
            '0000000000000000: 00000002 00000000 00010000 0001 01  9231 @mcdaemon\n' +
            '0000000000000000: 00000002 00000000 00010000 0001 01 245445 @com.application.myapp_devtools_remote\n' +
            '0000000000000000: 00000002 00000000 00010000 0001 01  2826 /dev/socket/installd\n'
          );
        });
      });

      describe('and the device socket is not specified', function () {
        beforeEach(async function () {
          const webviewsMapping = await webviewHelpers.getWebViewsMapping.bind(driver)({
            ensureWebviewsHavePages: false,
            enableWebviewDetailsCollection: false,
          });
          webViews = webviewHelpers.parseWebviewNames.bind(driver)(webviewsMapping, {
            ensureWebviewsHavePages: false,
          });
        });

        it('then the unix sockets are queried', function () {
          expect(stubbedShell.calledOnce).to.be.true;
          expect(stubbedShell.getCall(0).args[0]).to.deep.equal(['cat', '/proc/net/unix']);
        });

        it('then the webview is returned', function () {
          expect(webViews.length).to.equal(1);
          expect(webViews).to.deep.equal(['WEBVIEW_com.application.myapp']);
        });
      });

      describe('and the device socket is specified', function () {
        beforeEach(async function () {
          const webviewsMapping = await webviewHelpers.getWebViewsMapping.bind(driver)({
            androidDeviceSocket: 'com.application.myapp_devtools_remote',
            ensureWebviewsHavePages: false,
            enableWebviewDetailsCollection: false,
          });
          webViews = webviewHelpers.parseWebviewNames.bind(driver)(webviewsMapping, {
            ensureWebviewsHavePages: false,
          });
        });

        it('then the unix sockets are queried', function () {
          expect(stubbedShell.calledOnce).to.be.true;
          expect(stubbedShell.getCall(0).args[0]).to.deep.equal(['cat', '/proc/net/unix']);
        });

        it('then the webview is returned', function () {
          expect(webViews.length).to.equal(1);
          expect(webViews).to.deep.equal(['WEBVIEW_com.application.myapp']);
        });
      });

      describe('and the device socket is specified but is not found', function () {
        beforeEach(async function () {
          const webviewsMapping = await webviewHelpers.getWebViewsMapping.bind(driver)({
            androidDeviceSocket: 'com.application.myotherapp_devtools_remote',
          });
          webViews = webviewHelpers.parseWebviewNames.bind(driver)(webviewsMapping);
        });

        it('then the unix sockets are queried', function () {
          expect(stubbedShell.calledOnce).to.be.true;
          expect(stubbedShell.getCall(0).args[0]).to.deep.equal(['cat', '/proc/net/unix']);
        });

        it('then no webviews are returned', function () {
          expect(webViews.length).to.equal(0);
        });
      });
    });

    describe('and stetho socket exists', function () {
      let webViews;

      beforeEach(function () {
        stubbedShell = sandbox.stub(adb, 'shell').callsFake(function () {
          return (
            'Num       RefCount Protocol Flags    Type St Inode Path\n' +
            '0000000000000000: 00000002 00000000 00010000 0001 01  2818 /dev/socket/ss_conn_daemon\n' +
            '0000000000000000: 00000002 00000000 00010000 0001 01  9231 @mcdaemon\n' +
            '0000000000000000: 00000002 00000000 00010000 0001 01 245445 @stetho_com.google.android.apps.messaging_devtools_remote\n' +
            '0000000000000000: 00000002 00000000 00010000 0001 01  2826 /dev/socket/installd\n'
          );
        });
      });

      describe('and the device socket is not specified', function () {
        beforeEach(async function () {
          const webviewsMapping = await webviewHelpers.getWebViewsMapping.bind(driver)({
            ensureWebviewsHavePages: false,
            enableWebviewDetailsCollection: false,
          });
          webViews = webviewHelpers.parseWebviewNames.bind(driver)(webviewsMapping, {
            ensureWebviewsHavePages: false,
          });
        });

        it('then the unix sockets are queried', function () {
          expect(stubbedShell.calledOnce).to.be.true;
          expect(stubbedShell.getCall(0).args[0]).to.deep.equal(['cat', '/proc/net/unix']);
        });

        it('then the stetho socket is skipped and no webviews are returned', function () {
          expect(webViews.length).to.equal(0);
        });
      });
    });
  });
});
