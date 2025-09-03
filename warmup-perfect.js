const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const fs = require("fs");
const blessed = require("blessed");

// ===== Load konfigurasi =====
let akunList = JSON.parse(fs.readFileSync("akun.json", "utf-8"));
let templates = JSON.parse(fs.readFileSync("chat_templates.json", "utf-8"));

let clients = {};
let manualStatus = {};
akunList.forEach(a => manualStatus[a.name] = true);

// Path Chrome Android
const chromePath = "/data/data/com.android.chrome/app_chrome/Default/Chrome";

// ===== Inisialisasi client =====
function initializeClients() {
    akunList.forEach(a => {
        if (clients[a.name]) return;
        const client = new Client({
            puppeteer: {
                executablePath: chromePath,
                headless: true,
                args: ['--no-sandbox','--disable-setuid-sandbox']
            },
            authStrategy: new LocalAuth({ clientId: a.name })
        });

        client.on('qr', qr => qrcode.generate(qr,{small:true}));
        client.on('ready', ()=>{ a.status="READY"; });
        client.on('disconnected', reason=>{ a.status="TERPUTUS"; manualStatus[a.name]=false; });
        client.on('auth_failure', msg=>{ a.status="TERPUTUS"; manualStatus[a.name]=false; });

        client.initialize();
        clients[a.name]=client;
    });
}

// ===== GUI terminal =====
const screen = blessed.screen({ smartCSR:true });
screen.title = "WA Warmup Termux GUI";

const box = blessed.box({
    top:0,left:0,width:'100%',height:'100%',
    label:'WA Warmup Multi-akun',
    border:{type:'line'},
    style:{border:{fg:'cyan'}}
});
screen.append(box);

let buttons = [];
function createButtons(){
    buttons.forEach(btn=>btn.detach());
    buttons=[];
    akunList.forEach((a,i)=>{
        const btn = blessed.button({
            parent: box,
            top:2+i, left:2,
            content:`[OFF] ${a.name}`,
            style:{fg:'white', bg:'red'}
        });
        btn.on('press', ()=>{
            manualStatus[a.name]=!manualStatus[a.name];
            btn.setContent(`[${manualStatus[a.name]?"ON":"OFF"}] ${a.name}`);
            btn.style.bg=manualStatus[a.name]?"green":"red";
            updateStatus();
        });
        buttons.push(btn);
    });
}
createButtons();

screen.key(['q','C-c'],()=>process.exit(0));

function isActiveNow(account){
    const now=new Date();
    const [fromH,fromM]=account.activeFrom.split(":").map(Number);
    const [toH,toM]=account.activeTo.split(":").map(Number);
    const start=new Date(); start.setHours(fromH,fromM,0);
    const end=new Date(); end.setHours(toH,toM,0);
    return now>=start && now<=end;
}

function updateStatus(){
    let content="Status Akun:\n";
    akunList.forEach(a=>{
        let manual=manualStatus[a.name]?"ON":"OFF";
        if(a.status==="TERPUTUS") manual="OFF";
        let jam=isActiveNow(a)?"DALAM JAM AKTIF":"LUAR JAM AKTIF";
        content+=`${a.name}: ${manual} | ${jam} | ${a.status}\n`;
    });
    box.setContent(content+"\nKlik tombol ON/OFF. Q/Ctrl-C keluar");
    screen.render();
}
updateStatus();

// ===== Auto chat loop =====
async function autoChat(){
    while(true){
        initializeClients();
        createButtons();
        updateStatus();

        const aktif = akunList.filter(a=>manualStatus[a.name] && isActiveNow(a) && a.status!=="TERPUTUS");

        if(aktif.length>=2){
            let turns = Math.floor(Math.random()*(15-10+1))+10;
            for(let i=0;i<turns;i++){
                let sender,receiver;
                do{
                    sender=aktif[Math.floor(Math.random()*aktif.length)];
                    receiver=aktif[Math.floor(Math.random()*aktif.length)];
                }while(sender.name===receiver.name);

                let msg=templates[Math.floor(Math.random()*templates.length)];
                try{
                    await clients[sender.name].sendMessage(receiver.number+"@c.us",msg);
                    console.log(`${sender.name} => ${receiver.name}: ${msg}`);
                }catch(e){}

                let delay=Math.floor(Math.random()*55+5);
                await new Promise(r=>setTimeout(r,delay*1000));
            }
        } else {
            await new Promise(r=>setTimeout(r,10000));
        }
    }
}

// ===== Jalankan =====
initializeClients();
autoChat();
