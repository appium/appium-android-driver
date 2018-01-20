import sinon from 'sinon';
import helpers from '../../lib/webview-helpers';
import ADB from 'appium-adb';

let sandbox = sinon.sandbox.create();

describe('Webview Helpers', function () {
  let adb = new ADB();

  afterEach(function () {
    sandbox.restore();
  });

  describe('procFromWebview', function () {
    const webview = 'WEBVIEW_123';
    const pkg = 'io.appium.android.apis';

    it('should get package name when all fields are filled', async function () {
      sandbox.stub(adb, 'shell', function () {
        return 'USER           PID  PPID     VSZ    RSS WCHAN            ADDR S NAME\n' +
               'root             1     0    9948   2344 SyS_epoll_wait      0 S init\n' +
               'root             2     0       0      0 kthreadd            0 S [kthreadd]\n' +
               'root             3     2       0      0 smpboot_thread_fn   0 S [ksoftirqd/0]\n' +
               'root             5     2       0      0 worker_thread       0 S [kworker/0:0H]\n' +
               'root             7     2       0      0 rcu_gp_kthread      0 S [rcu_preempt]\n' +
               'u0_a88         123  1313 1513968 135756 ffffffff            0 R io.appium.android.apis\n';
      });

      let name = await helpers.procFromWebview(adb, webview);
      name.should.eql(pkg);
    });
    it('should get package name when some fields are empty', async function () {
      sandbox.stub(adb, 'shell', function () {
        return 'USER           PID  PPID     VSZ    RSS WCHAN            ADDR S NAME\n' +
               'root             1     0    9948   2344 SyS_epoll_wait      0 S init\n' +
               'root             2     0       0      0 kthreadd            0 S [kthreadd]\n' +
               'root             3     2       0      0 smpboot_thread_fn   0 S [ksoftirqd/0]\n' +
               'root             5     2       0      0 worker_thread       0 S [kworker/0:0H]\n' +
               'root             7     2       0      0 rcu_gp_kthread      0 S [rcu_preempt]\n' +
               'u0_a88         123  1313 1513968 135756                     0 R io.appium.android.apis\n';
      });

      let name = await helpers.procFromWebview(adb, webview);
      name.should.eql(pkg);
    });
    it('should get package name when some headers are empty', async function () {
      sandbox.stub(adb, 'shell', function () {
        return 'USER           PID  PPID     VSZ    RSS WCHAN            ADDR   NAME\n' +
               'root             1     0    9948   2344 SyS_epoll_wait      0 S init\n' +
               'root             2     0       0      0 kthreadd            0 S [kthreadd]\n' +
               'root             3     2       0      0 smpboot_thread_fn   0 S [ksoftirqd/0]\n' +
               'root             5     2       0      0 worker_thread       0 S [kworker/0:0H]\n' +
               'root             7     2       0      0 rcu_gp_kthread      0 S [rcu_preempt]\n' +
               'u0_a88         123  1313 1513968 135756 ffffffff            0 R io.appium.android.apis\n';
      });

      let name = await helpers.procFromWebview(adb, webview);
      name.should.eql(pkg);
    });
    it('should get package name when some headers and fields are empty', async function () {
      sandbox.stub(adb, 'shell', function () {
        return 'USER           PID  PPID     VSZ    RSS WCHAN            ADDR   NAME\n' +
               'root             1     0    9948   2344 SyS_epoll_wait      0 S init\n' +
               'root             2     0       0      0 kthreadd            0 S [kthreadd]\n' +
               'root             3     2       0      0 smpboot_thread_fn   0 S [ksoftirqd/0]\n' +
               'root             5     2       0      0 worker_thread       0 S [kworker/0:0H]\n' +
               'root             7     2       0      0 rcu_gp_kthread      0 S [rcu_preempt]\n' +
               'u0_a88         123  1313 1513968 135756                     0 R io.appium.android.apis\n';
      });

      let name = await helpers.procFromWebview(adb, webview);
      name.should.eql(pkg);
    });
  });

  describe('When the webviews are obtained', function () {
    describe('for an app that embeds Chromium', function () {
      let webViews;

      beforeEach(async function () {
        sandbox.stub(adb, 'shell', () => {
          return 'Num       RefCount Protocol Flags    Type St Inode Path\n' +
                '0000000000000000: 00000002 00000000 00010000 0001 01  2818 /dev/socket/ss_conn_daemon\n' +
                '0000000000000000: 00000002 00000000 00010000 0001 01  9231 @mcdaemon\n' +
                '0000000000000000: 00000002 00000000 00010000 0001 01 245445 @webview_devtools_remote_123\n' +
                '0000000000000000: 00000002 00000000 00010000 0001 01  2826 /dev/socket/installd\n';
        });

        webViews = await helpers.getWebviews(adb, 'webview_devtools_remote_123');
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
        sandbox.stub(adb, 'shell', function () {
          return 'Num       RefCount Protocol Flags    Type St Inode Path\n' +
                '0000000000000000: 00000002 00000000 00010000 0001 01  2818 /dev/socket/ss_conn_daemon\n' +
                '0000000000000000: 00000002 00000000 00010000 0001 01  9231 @mcdaemon\n' +
                '0000000000000000: 00000002 00000000 00010000 0001 01 245445 @chrome_devtools_remote\n' +
                '0000000000000000: 00000002 00000000 00010000 0001 01  2826 /dev/socket/installd\n';
        });

        webViews = await helpers.getWebviews(adb, 'chrome_devtools_remote');
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
        sandbox.stub(adb, 'shell', function () {
          return 'Num       RefCount Protocol Flags    Type St Inode Path\n' +
                '0000000000000000: 00000002 00000000 00010000 0001 01  2818 /dev/socket/ss_conn_daemon\n' +
                '0000000000000000: 00000002 00000000 00010000 0001 01  9231 @mcdaemon\n' +
                '0000000000000000: 00000002 00000000 00010000 0001 01  2826 /dev/socket/installd\n';
        });

        webViews = await helpers.getWebviews(adb);
      });

      it('then the unix sockets are queried', function () {
        adb.shell.calledOnce.should.be.true;
        adb.shell.getCall(0).args[0].should.deep.equal(['cat', '/proc/net/unix']);
      });

      it('then no webviews are returned', function () {
        webViews.length.should.equal(0);
      });
    });

    describe('and crosswalk webviews exist', function () {
      let webViews;

      beforeEach(function () {
        sandbox.stub(adb, 'shell', () => {
          return 'Num       RefCount Protocol Flags    Type St Inode Path\n' +
                '0000000000000000: 00000002 00000000 00010000 0001 01  2818 /dev/socket/ss_conn_daemon\n' +
                '0000000000000000: 00000002 00000000 00010000 0001 01  9231 @mcdaemon\n' +
                '0000000000000000: 00000002 00000000 00010000 0001 01 245445 @com.application.myapp_devtools_remote\n' +
                '0000000000000000: 00000002 00000000 00010000 0001 01  2826 /dev/socket/installd\n';
        });
      });

      describe('and the device socket is not specified', function () {
        beforeEach(async function () {
          webViews = await helpers.getWebviews(adb);
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
          webViews = await helpers.getWebviews(adb, 'com.application.myapp_devtools_remote');
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
          webViews = await helpers.getWebviews(adb, 'com.application.myotherapp_devtools_remote');
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

    describe('and webviews exist', function () {
      let webViews;

      beforeEach(async function () {
        let shellStub = sandbox.stub(adb, 'shell');

        shellStub.onCall(0).returns('Num               RefCount Protocol Flags    Type St Inode Path\n' +
                                    '0000000000000000: 00000002 00000000 00010000 0001 01  2818 /dev/socket/ss_conn_daemon\n' +
                                    '0000000000000000: 00000002 00000000 00010000 0001 01  9231 @mcdaemon\n' +
                                    '0000000000000000: 00000002 00000000 00010000 0001 01 245445 @webview_devtools_remote_1234\n' +
                                    '0000000000000000: 00000002 00000000 00010000 0001 01  2826 /dev/socket/installd\n');
        shellStub.onCall(1).returns('USER    PID  PPID VSIZE   RSS   WCHAN              PC   NAME\n' +
                                    'root      1     0  5792   988   SyS_epoll_ 0000000000 S /init\n' +
                                    'root      2     0     0     0   kthreadd   0000000000 S kthreadd\n' +
                                    'root   1234     2     0     0   SyS_epoll_ 0000000000 S com.application.myapp\n');

        webViews = await helpers.getWebviews(adb);
      });

      it('then the unix sockets and process list are queried', function () {
        adb.shell.calledTwice.should.be.true;
        adb.shell.getCall(0).args[0].should.deep.equal(['cat', '/proc/net/unix']);
        adb.shell.getCall(1).args[0].should.equal('ps');
      });

      it('then the webview is returned', function () {
        webViews.length.should.equal(1);
        webViews.should.deep.equal(['WEBVIEW_com.application.myapp']);
      });
    });
  });
});
