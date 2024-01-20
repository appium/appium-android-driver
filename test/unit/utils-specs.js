import { parseArray } from '../../lib/utils';

describe('Utils', function () {

  describe('#parseArray', function () {
    it('should parse array string to array', function () {
      parseArray('["a", "b", "c"]').should.eql(['a', 'b', 'c']);
    });
    it('should parse a simple string to one item array', function () {
      parseArray('abc').should.eql(['abc']);
    });
  });

});
