document.getElementById("year").textContent = new Date().getFullYear();

const form = document.getElementById("host-form");
const lobbyView = document.getElementById("lobby-view");
const codeEl = document.getElementById("lobby-code");
const copyBtn = document.getElementById("copy-code");
const inviteLink = document.getElementById("invite-link");
const quizSelect = document.getElementById("quizSelect");

function generateCode(len=6){
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out=""; for(let i=0;i<len;i++) out+=chars[Math.floor(Math.random()*chars.length)];
  return out;
}

form.addEventListener("submit",(e)=>{
  e.preventDefault();
  const data = new FormData(form);
  const game = {
    id: crypto.randomUUID(),
    name: String(data.get("gameName")||"").trim(),
    host: String(data.get("nickname")||"").trim(),
    maxPlayers: Number(data.get("maxPlayers")),
    pin: String(data.get("pin")||""),
    code: generateCode(),
    createdAt: Date.now(),
    players: []
  };
  const selectedQuizId = quizSelect.value;
    if(!selectedQuizId){
      alert("Bitte ein Quiz auswählen.");
    return;
}
game.quizId = selectedQuizId;
  if(!game.name || !game.host || game.maxPlayers<2){ alert("Bitte alle Pflichtfelder prüfen."); return; }

  const key="quiz:lobbies";
  const lobbies = JSON.parse(localStorage.getItem(key)||"[]");
  lobbies.push(game);
  localStorage.setItem(key, JSON.stringify(lobbies));

  codeEl.textContent = game.code;
  const link = new URL(location.origin + location.pathname.replace("host.html","join.html"));
  link.searchParams.set("code", game.code);
  inviteLink.href = link.toString();

  form.style.display="none";
  lobbyView.style.display="block";
});

copyBtn.addEventListener("click", async ()=>{
  try{
    await navigator.clipboard.writeText(codeEl.textContent.trim());
    copyBtn.textContent="Kopiert!"; setTimeout(()=>copyBtn.textContent="Kopieren",1200);
  }catch{ alert("Kopieren fehlgeschlagen – bitte manuell markieren."); }
});
