/* eslint-disable @typescript-eslint/no-require-imports -- Local Node CommonJS runner. */
// Local-only verification server. Never use a remote database or delivery credentials.
const {spawn}=require('node:child_process');
const env={...process.env,DATABASE_URL:'postgresql://postgres@127.0.0.1:55439/lumaclean_admin_test',DIRECT_URL:'postgresql://postgres@127.0.0.1:55439/lumaclean_admin_test',BETTER_AUTH_URL:'http://localhost:3100',TELEGRAM_BOT_TOKEN:'',TELEGRAM_CHAT_ID:''};
const next=require.resolve('next/dist/bin/next');
const child=spawn(process.execPath,[next,'start','--port','3100'],{env,stdio:'inherit',windowsHide:true});
process.on('SIGINT',()=>child.kill());
child.on('exit',code=>{process.exitCode=code ?? 1;});
