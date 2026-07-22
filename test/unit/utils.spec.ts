import {parseArray} from '../../lib/utils.js';
import {expect} from 'chai';
import {describe, it} from 'node:test';

describe('Utils', function () {
  describe('#parseArray', function () {
    it('should parse array string to array', function () {
      expect(parseArray('["a", "b", "c"]')).to.eql(['a', 'b', 'c']);
    });
    it('should parse a simple string to one item array', function () {
      expect(parseArray('abc')).to.eql(['abc']);
    });
  });
});
