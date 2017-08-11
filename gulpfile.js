"use strict";

const gulp = require('gulp');
const boilerplate = require('appium-gulp-plugins').boilerplate.use(gulp);

boilerplate({
  build: 'appium-android-driver',
  e2eTest: {android: true},
  testTimeout: 40000,
  coverage: {
    files: ['./test/unit/**/*-specs.js', '!./test/functional/**', '!./test/assets'],
    verbose: true
  },
});
