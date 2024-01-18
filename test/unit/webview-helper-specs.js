import sinon from 'sinon';
import helpers, {DEVTOOLS_SOCKET_PATTERN} from '../../lib/helpers/webview';
import ADB from 'appium-adb';
import chai from 'chai';

chai.should();

let sandbox = sinon.createSandbox();

describe('Webview Helpers', function () {
  let adb = new ADB();

  afterEach(function () {
    sandbox.restore();
  });

  describe('DEVTOOLS_SOCKET_PATTERN', function () {
    it('patting patterns with webview_devtools_remote_22138', function () {
      DEVTOOLS_SOCKET_PATTERN.test('@webview_devtools_remote_22138').should.be.true;
    });
    it('patting patterns with webview_devtools_remote_m6x_27719', function () {
      DEVTOOLS_SOCKET_PATTERN.test('@webview_devtools_remote_m6x_27719').should.be.true;
    });
    it('patting patterns with chrome_devtools_remote', function () {
      DEVTOOLS_SOCKET_PATTERN.test('@chrome_devtools_remote').should.be.true;
    });
  }),
    describe('When the webviews are obtained', function () {
      describe('for an app that embeds Chromium', function () {
        let webViews;

        beforeEach(async function () {
          sandbox.stub(adb, 'shell').callsFake(function () {
            return (
              'Num       RefCount Protocol Flags    Type St Inode Path\n' +
              '0000000000000000: 00000002 00000000 00010000 0001 01  2818 /dev/socket/ss_conn_daemon\n' +
              '0000000000000000: 00000002 00000000 00010000 0001 01  9231 @mcdaemon\n' +
              '0000000000000000: 00000002 00000000 00010000 0001 01 245445 @webview_devtools_remote_123\n' +
              '0000000000000000: 00000002 00000000 00010000 0001 01  2826 /dev/socket/installd\n'
            );
          });
          const webviewsMapping = await helpers.getWebViewsMapping(adb, {
            androidDeviceSocket: 'webview_devtools_remote_123',
          });
          webViews = helpers.parseWebviewNames(webviewsMapping, {
            ensureWebviewsHavePages: false,
          });
        });

        it('then the unix sockets are queried', function () {
          adb.shell.calledOnce.should.be.true;
          adb.shell.getCall(0).args[0].should.deep.equal(['cat', '/proc/net/unix']);
        });

        it('then the webview is returned', function () {
          webViews.length.should.equal(1);
          webViews.should.deep.equal(['WEBVIEW_123']);
        });
      });

      describe('for a Chromium webview', function () {
        let webViews;

        beforeEach(async function () {
          sandbox.stub(adb, 'shell').callsFake(function () {
            return (
              'Num       RefCount Protocol Flags    Type St Inode Path\n' +
              '0000000000000000: 00000002 00000000 00010000 0001 01  2818 /dev/socket/ss_conn_daemon\n' +
              '0000000000000000: 00000002 00000000 00010000 0001 01  9231 @mcdaemon\n' +
              '0000000000000000: 00000002 00000000 00010000 0001 01 245445 @chrome_devtools_remote\n' +
              '0000000000000000: 00000002 00000000 00010000 0001 01  2826 /dev/socket/installd\n'
            );
          });

          const webviewsMapping = await helpers.getWebViewsMapping(adb, {
            androidDeviceSocket: 'chrome_devtools_remote',
          });
          webViews = helpers.parseWebviewNames(webviewsMapping, {
            ensureWebviewsHavePages: false,
          });
        });

        it('then the unix sockets are queried', function () {
          adb.shell.calledOnce.should.be.true;
          adb.shell.getCall(0).args[0].should.deep.equal(['cat', '/proc/net/unix']);
        });

        it('then the webview is returned', function () {
          webViews.length.should.equal(1);
          webViews.should.deep.equal(['CHROMIUM']);
        });
      });

      describe('and no webviews exist', function () {
        let webViews;

        beforeEach(async function () {
          sandbox.stub(adb, 'shell').callsFake(function () {
            return (
              'Num       RefCount Protocol Flags    Type St Inode Path\n' +
              '0000000000000000: 00000002 00000000 00010000 0001 01  2818 /dev/socket/ss_conn_daemon\n' +
              '0000000000000000: 00000002 00000000 00010000 0001 01  9231 @mcdaemon\n' +
              '0000000000000000: 00000002 00000000 00010000 0001 01  2826 /dev/socket/installd\n'
            );
          });

          const webviewsMapping = await helpers.getWebViewsMapping(adb);
          webViews = helpers.parseWebviewNames(webviewsMapping);
        });

        it('then the unix sockets are queried', function () {
          adb.shell.calledOnce.should.be.true;
          adb.shell.getCall(0).args[0].should.deep.equal(['cat', '/proc/net/unix']);
        });

        it('then no webviews are returned', function () {
          webViews.length.should.equal(0);
        });
      });

      describe('and page existence is ensured', function () {
        let webViews;

        beforeEach(async function () {
          sandbox.stub(adb, 'shell').callsFake(function () {
            return (
              'Num       RefCount Protocol Flags    Type St Inode Path\n' +
              '0000000000000000: 00000002 00000000 00010000 0001 01  2818 /dev/socket/ss_conn_daemon\n' +
              '0000000000000000: 00000002 00000000 00010000 0001 01  9231 @mcdaemon\n' +
              '0000000000000000: 00000002 00000000 00010000 0001 01 245445 @webview_devtools_remote_123\n' +
              '0000000000000000: 00000002 00000000 00010000 0001 01  2826 /dev/socket/installd\n'
            );
          });
        });

        describe('and webviews are unreachable', function () {
          beforeEach(async function () {
            const webviewsMapping = await helpers.getWebViewsMapping(adb, {
              androidDeviceSocket: 'webview_devtools_remote_123',
            });
            webviewsMapping.length.should.equal(1);
            webviewsMapping[0].should.not.have.key('pages');
            webViews = helpers.parseWebviewNames(webviewsMapping);
          });

          it('then the unix sockets are queried', function () {
            adb.shell.calledOnce.should.be.true;
            adb.shell.getCall(0).args[0].should.deep.equal(['cat', '/proc/net/unix']);
          });

          it('then no webviews are returned', function () {
            webViews.length.should.equal(0);
          });
        });
      });

      describe('and crosswalk webviews exist', function () {
        let webViews;

        beforeEach(function () {
          sandbox.stub(adb, 'shell').callsFake(function () {
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
            const webviewsMapping = await helpers.getWebViewsMapping(adb);
            webViews = helpers.parseWebviewNames(webviewsMapping, {
              ensureWebviewsHavePages: false,
            });
          });

          it('then the unix sockets are queried', function () {
            adb.shell.calledOnce.should.be.true;
            adb.shell.getCall(0).args[0].should.deep.equal(['cat', '/proc/net/unix']);
          });

          it('then the webview is returned', function () {
            webViews.length.should.equal(1);
            webViews.should.deep.equal(['WEBVIEW_com.application.myapp']);
          });
        });

        describe('and the device socket is specified', function () {
          beforeEach(async function () {
            const webviewsMapping = await helpers.getWebViewsMapping(adb, {
              androidDeviceSocket: 'com.application.myapp_devtools_remote',
            });
            webViews = helpers.parseWebviewNames(webviewsMapping, {
              ensureWebviewsHavePages: false,
            });
          });

          it('then the unix sockets are queried', function () {
            adb.shell.calledOnce.should.be.true;
            adb.shell.getCall(0).args[0].should.deep.equal(['cat', '/proc/net/unix']);
          });

          it('then the webview is returned', function () {
            webViews.length.should.equal(1);
            webViews.should.deep.equal(['WEBVIEW_com.application.myapp']);
          });
        });

        describe('and the device socket is specified but is not found', function () {
          beforeEach(async function () {
            const webviewsMapping = await helpers.getWebViewsMapping(adb, {
              androidDeviceSocket: 'com.application.myotherapp_devtools_remote',
            });
            webViews = helpers.parseWebviewNames(webviewsMapping);
          });

          it('then the unix sockets are queried', function () {
            adb.shell.calledOnce.should.be.true;
            adb.shell.getCall(0).args[0].should.deep.equal(['cat', '/proc/net/unix']);
          });

          it('then no webviews are returned', function () {
            webViews.length.should.equal(0);
          });
        });
      });
    });
});
