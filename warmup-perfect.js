const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const fs = require("fs");

// ===== LOAD KONFIGURASI =====
let akunList = JSON.parse(fs.readFileSync("akun.json", "utf-8"));
let templates = JSON.parse(fs.readFileSync("chat_templates.json", "utf-8"));

let clients = {};
let manualStatus = {};
akunList.forEach(a => manualStatus[a.name] = true); // otomatis ON

// ===== INISIALISASI CLIENT =====
function initializeClients() {
    akunList.forEach(a=>{
        if(clients[a.name]) return;
        const client = new Client({ authStrategy: new LocalAuth({ clientId: a.name }) });

        client.on('qr', qr => {
            console.log(`Scan QR untuk ${a.name}:`);
            qrcode.generate(qr,{small:true});
        });

        client.on('ready', ()=>{
            console.log(`${a.name} siap`);
            a.status="READY";
        });

        client.on('disconnected', reason=>{
            console.log(`${a.name} terputus: ${reason}`);
            manualStatus[a.name]=false;
            a.status="TERPUTUS";
        });

        client.on('auth_failure', msg=>{
            console.log(`${a.name} gagal autentikasi: ${msg}`);
            manualStatus[a.name]=false;
            a.status="TERPUTUS";
        });

        client.initialize();
        clients[a.name]=client;
    });
}

// ===== FUNGSI UTILITY =====
function isActiveNow(account){
    const now=new Date();
    const [fromH,fromM]=account.activeFrom.split(":").map(Number);
    const [toH,toM]=account.activeTo.split(":").map(Number);
    const start=new Date(); start.setHours(fromH,fromM,0);
    const end=new Date(); end.setHours(toH,toM,0);
    return now>=start && now<=end;
}

function showStatus() {
    console.clear();
    console.log("=== Status Akun ===");
    akunList.forEach(a=>{
        let status = (a.status==="TERPUTUS") ? "TERPUTUS" : "READY";
        let jam = isActiveNow(a) ? "DALAM JAM AKTIF" : "LUAR JAM AKTIF";
        let manual = manualStatus[a.name] ? "ON" : "OFF";
        console.log(`${a.name}: ${manual} | ${jam} | ${status}`);
    });
    console.log("===================");
}

// ===== AUTO CHAT LOOP OTOMATIS =====
async function autoChat() {
    while(true){
        // Auto-load akun baru jika ada
        initializeClients();

        const aktif = akunList.filter(a=>manualStatus[a.name] && isActiveNow(a) && a.status!=="TERPUTUS");
        showStatus();

        if(aktif.length>=2){
            // Random 10–15 chat
            let turns = Math.floor(Math.random()*(15-10+1))+10;
            for(let i=0;i<turns;i++){
                let sender,receiver;
                do{
                    sender = aktif[Math.floor(Math.random()*aktif.length)];
                    receiver = aktif[Math.floor(Math.random()*aktif.length)];
                }while(sender.name===receiver.name);

                // Random template chat
                let msg = templates[Math.floor(Math.random()*templates.length)];
                try{
                    await clients[sender.name].sendMessage(receiver.number+"@c.us",msg);
                    console.log(`${sender.name} => ${receiver.name}: ${msg}`);
                }catch(e){
                    console.log(`${sender.name} gagal kirim ke ${receiver.name}`);
                }

                // Random delay natural (5–60 detik)
                let delay = Math.floor(Math.random()*55+5);
                await new Promise(r=>setTimeout(r,delay*1000));
            }
        } else {
            await new Promise(r=>setTimeout(r,10000));
        }
    }
}

// ===== JALANKAN =====
initializeClients();
autoChat();