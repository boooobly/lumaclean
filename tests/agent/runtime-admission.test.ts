import test from 'node:test';
import assert from 'node:assert/strict';
import {effectiveMode} from '../../src/lib/agent/readiness';
test('uncertified release cannot run AUTO even if persisted channel mode remains AUTO',()=>{
  const enabled=process.env.AI_AGENT_ENABLED,verified=process.env.AI_VERIFIED_RELEASE;
  const settings={aiAgentMode:'AUTO' as const,aiChannelModes:{WEBSITE:'AUTO'}};
  try {
    process.env.AI_AGENT_ENABLED='true';
    for(const flag of ['false','',undefined]) {
      if(flag===undefined)delete process.env.AI_VERIFIED_RELEASE;else process.env.AI_VERIFIED_RELEASE=flag;
      assert.equal(effectiveMode(settings,'WEBSITE'),'OFF');
    }
    process.env.AI_VERIFIED_RELEASE='true';assert.equal(effectiveMode(settings,'WEBSITE'),'AUTO');
    process.env.AI_AGENT_ENABLED='false';assert.equal(effectiveMode(settings,'WEBSITE'),'OFF');
  } finally {
    if(enabled===undefined)delete process.env.AI_AGENT_ENABLED;else process.env.AI_AGENT_ENABLED=enabled;
    if(verified===undefined)delete process.env.AI_VERIFIED_RELEASE;else process.env.AI_VERIFIED_RELEASE=verified;
  }
});
