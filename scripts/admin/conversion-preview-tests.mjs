import {spawn} from 'node:child_process';
const url=process.env.DATABASE_URL;
if(!url||!new URL(url).hostname.startsWith('ep-wispy-river-b8xwqy9q'))throw Error('ISOLATED_PREVIEW_REQUIRED');
const child=spawn(process.execPath,['--conditions=react-server','--import','tsx','--test',...process.argv.slice(2)],{stdio:'inherit',windowsHide:true,env:{...process.env,AI_AGENT_ENABLED:'true',CONVERSION_TEST_DATABASE_URL:url,BEHAVIOR_TEST_DATABASE_URL:url}});
child.on('close',code=>process.exitCode=code??1);
