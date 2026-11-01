import test from 'node:test';
import assert from 'node:assert/strict';
import {calculatePrice} from '../../src/lib/pricing';

test('round final estimate up once, including a 750 RSD linen extra', () => {
  assert.equal(calculatePrice('regular',50,[{code:'linen',quantity:1}],false).total,6800);
  assert.equal(calculatePrice('regular',39,[{code:'linen',quantity:1}],false).total,5700);
});
test('apply 20% to raw area and extras, then ceil once', () => {
  assert.equal(calculatePrice('regular',103,[{code:'linen',quantity:1}],true).total,13100);
  assert.equal(calculatePrice('regular',39,[],true).total,5900);
});
