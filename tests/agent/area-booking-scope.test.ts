import test from'node:test';import assert from'node:assert/strict';
import{areaRequiresReview}from'../../src/lib/agent/autonomy';
test('owner area scope allows25–120inclusive and requires review above120',()=>{
 for(const area of[25,39.99,40,50,60,80,99.99,100,119.99,120])assert.equal(areaRequiresReview(area),false,String(area));
 for(const area of[0,24.99,120.01,121,150,180,181,1000,NaN,Infinity])assert.equal(areaRequiresReview(area),true,String(area));
});
