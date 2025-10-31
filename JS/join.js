document.getElementById("year").textContent = new Date().getFullYear();

const form = document.getElementById("join-form");
const codeInput = document.getElementById("code");
const pinWrap = document.getElementById("pin-wrap");
const pinInput = document.getElementById("join-pin");

const params = new URLSearchParams(location.search);
const prefill = params.get("code");
if(prefill){ codeInput.value = prefill.toUpperCase(); codeInput.readOnly = true; }

function findLobbyByCode(code){
  const lobbies = JSON.parse(localStorage.getItem("quiz:lobbies")||"[]");
  return lobbies.find(l=>l.code===code.toUpperCase());
}

codeInput.addEventListener("input", ()=>{
  const lob = findLobbyByCode(codeInput.value.trim());
  pinWrap.style.display = lob && lob.pin ? "block" : "none";
});

form.addEventListener("submit",(e)=>{
  e.preventDefault();
  const code = codeInput.value.trim().toUpperCase();
  const nick = document.getElementById("nick").value.trim();
  const pin  = pinInput?.value || "";

  const lobby = findLobbyByCode(code);
  if(!lobby){ alert("Lobby nicht gefunden."); return; }
  if(lobby.pin && lobby.pin !== pin){ alert("Falsche PIN."); return; }
  if(lobby.players.length >= lobby.maxPlayers){ alert("Lobby ist voll."); return; }

  const player = { id: crypto.randomUUID(), nick, joinedAt: Date.now() };
  lobby.players.push(player);
  const all = JSON.parse(localStorage.getItem("quiz:lobbies")||"[]");
  const idx = all.findIndex(l=>l.code===lobby.code);
  if(idx>=0) all[idx]=lobby;
  localStorage.setItem("quiz:lobbies", JSON.stringify(all));

  sessionStorage.setItem("quiz:current", JSON.stringify({ lobbyCode:lobby.code, playerId:player.id }));
  alert(`Beigetreten! Lobby: ${lobby.name} (${lobby.code})`);
});
