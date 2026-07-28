import assert from 'node:assert/strict';
import {describe, it} from 'node:test';

import {parseArray} from '../../lib/utils.js';

describe('Utils', function () {
  describe('#parseArray', function () {
    it('should parse array string to array', function () {
      assert.deepStrictEqual(parseArray('["a", "b", "c"]'), ['a', 'b', 'c']);
    });
    it('should parse a simple string to one item array', function () {
      assert.deepStrictEqual(parseArray('abc'), ['abc']);
    });
  });
});
