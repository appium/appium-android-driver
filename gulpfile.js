"use strict";

const teen_process = require('teen_process');
const system = require('appium-support').system;
const gulp = require('gulp');
const boilerplate = require('appium-gulp-plugins').boilerplate.use(gulp);


const ANT_CMD = system.isWindows() ? 'ant.bat' : 'ant';

gulp.task('ant-clean', function () {
  return teen_process.exec(ANT_CMD, ['clean'], {cwd: 'bootstrap'});
});

gulp.task('ant-build', ['ant-clean'], function () {
  return teen_process.exec(ANT_CMD, ['build'], {cwd: 'bootstrap'});
});

gulp.task('ant', ['ant-clean', 'ant-build']);


boilerplate({
  build: 'appium-android-driver',
  extraPrepublishTasks: ['ant'],
  e2eTest: {android: true},
  testTimeout: 40000,
  coverage: {
    files: ['./test/unit/**/*-specs.js', '!./test/functional/**', '!./test/assets'],
    verbose: true
  },
});
