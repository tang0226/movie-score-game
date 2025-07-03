/**
TODO / PLANNING:
Store player information locally
v Times go to server.
v Server sends times to clients.
v Clients receive times ("player guessed correctly" msg)
v Server calculates scores.
v Scores get sent to clients.

Core:
Next round starts when all players confirm
Perform game-end checks (round counter, and player scores)
Handle disconnections:
 * any time a player disconnects, store their player object AND IP ADDRESS together.
 * In the game and session game objects, mark the player as "disconnected." They will not be counted in any round that BEGINS while they are still disconnected
 * If a player later joins with the same IP Address and name(?), treat them as the disconnected player. They can join the next round that starts, and also mkae sure that all other players are notified from the server.
 * A reconnected player can have round results marked as "disconnected" with no points scored.
 * If all players in a game disconnect, maybe wait a certain amount of time? If no players return, then delete the game.

Smaller:
Refactor player cards and points displays
Store detailed results in client session (for client-side statistics and visualizations)
Allow players to join mid-game
 * If rounds have already been played, create round-results for previous round, marked as "absent" or something of the like.
 * Player cards will be modified
Fix Quit button layout
Bug: "Song playing..." displays in between rounds

Larger:
Movie picking
 * Checkmarks next to names, and then album covers with x-icon on hover, click = remove
 * Filters (Studio, composer, etc.)
   * This will involve adding more data and parsing to the movie data text file
Visualizations and statistics tables
 * Canvas time, baby!

Long term:
secrecy (options to show when ppl guess, what they guessed, when they ran out of guesses, or nothing at all!)
player colors? avatars?
movie "drafting"? alternating picking movies for a set?
Song filtering? (lyrics / no lyrics)


IDEAS FOR LAYOUT:
v HUD, volume, timing bar, and movie tiles in center
v Left: Scoreboard (name: points), with progress-bar-style graphing of relative points.
v Right: log (players joining, leaving, guessing, dq-ing, winning)

Main structure:
Full-screen div, display flex, align-items center vertically
within this full-screen div, have a centered main container
This centered main container can simply be a display block (intro-view)

OR it can be a display flex containing the three main columns (game and gameplay views)

*/

// Youtube iframe API
var YT_IFRAME_API_READY, YT_PLAYER;

var tag = document.createElement("script");
tag.id = "iframe-api";
tag.src = "https://www.youtube.com/iframe_api";
document.body.appendChild(tag);

function onYouTubeIframeAPIReady() {
  YT_IFRAME_API_READY = true;
  YT_PLAYER = new YT.Player("yt-player", {
    playerVars: {
      "controls": 0,
      "rel": 0,
    },
    events: {
      "onReady": onPlayerReady,
      "onStateChange": onPlayerStateChange,
    }
  });
}

function onPlayerReady(event) {
  YT_PLAYER.setVolume(Number(document.querySelector("#volume-slider").value));
}

// experiment (temp)
var lastStateTime = 0;
function onPlayerStateChange(event) {
  // Prevent cheating with devtools
  document.getElementById("yt-player").title = "";

  let time = performance.now()
  console.log(event.data, (time - lastStateTime) / 1000);
  lastStateTime = time;
  switch(event.data) {
    case 1:
      ytPlayer.stretchStartTime = performance.now();

      if (!ytPlayer.songBuffering) {
        ytPlayer.cumStretchTime = 0;
      }
      else {
        ytPlayer.songBuffering = false;
      }

      roundStatusEle.innerText = "Song playing...";
      ytPlayer.songPlaying = true;
      break;
    case 2:
      YT_PLAYER.playVideo();
      break;
    case 3:
      if (ytPlayer.songPlaying) {
        console.warn("BUFFERING");
        ytPlayer.cumStretchTime += performance.now() - ytPlayer.stretchStartTime;
        ytPlayer.stretchStartTime = null;
        ytPlayer.songPlaying = false;
        ytPlayer.songBuffering = true;
        roundStatusEle.innerText = "Song buffering...";
      }
  }
}




function getElapsedSongTime() {
  return performance.now() - ytPlayer.stretchStartTime + ytPlayer.cumStretchTime;
}

// Object storing data about the YT player status and play time.
var ytPlayer = {
  stretchStartTime: null,
  cumStretchTime: 0,
  songPlaying: false,
  songBuffering: false,
};

var progressBarInterval;


// iife . . .
(() => {

// elements
var introView = document.getElementById("intro-view");
var gameView = document.getElementById("game-view");
var settingsSection = document.getElementById("settings-section");
var gameplaySection = document.getElementById("gameplay-section");
var tilesSection = document.getElementById("tiles-section");

// Intro view
var nameInput = document.getElementById("name");
var gameIdInput = document.getElementById("game-id");
var createGameButton = document.getElementById("create-game");
var joinGameButton = document.getElementById("join-game");

// Game view (always)
var playerList = document.getElementById("player-list");
var log = document.getElementById("log");
var quitButton = document.getElementById("quit-button");

// Game settings section
var gameEndTypeInput = document.getElementById("game-end-type");
var roundsInput = document.getElementById("rounds-input");
var pointsInput = document.getElementById("points-input");
var listenTimeInput = document.getElementById("listen-time-input");
var guessesInput = document.getElementById("guesses-input");
var startButton = document.getElementById("start-game");

var settingsInputs = [gameEndTypeInput, roundsInput, pointsInput, listenTimeInput, guessesInput, startButton];

// Gameplay section
var nextButton = document.getElementById("next");
var progressBar = document.getElementById("progress-bar").children[0];
var volumeSlider = document.getElementById("volume-slider");
window.roundStatusEle = document.getElementById("round-status");
var guessesLeftEle = document.getElementById("guesses-left");


var root = document.querySelector(":root");


// Socket.io
const socket = io();



roundsInput.value = 10;
pointsInput.value = 10000;

// Utils
function showEle(ele) {
  ele.classList.remove("hidden");
}

function hideEle(ele) {
  ele.classList.add("hidden");
}



// Variables
var player = {};
var game = {
  settings: {},
  roundInProgress: false,
};

// Stores information about the ui, including element ids related to the game
var ui = { quitButtonActive: false, wrongGuessIds: [] };

const TIME_DP = 2;
function formatMs(ms) {
  return Math.round(ms / 1000 * 10 ** TIME_DP) / 10 ** TIME_DP
}


// HTML and DOM functions

// Clears the player list and tiles section
function resetGameUI() {
  playerList.innerHTML = "";
  tilesSection.innerHTML = "";
  progressBar.style.width = "0px";
  guessesLeftEle.innerText = "";
  log.innerHTML = "<div>Welcome to ScoreGame!</div>";
}

/*
function createPlayerCard(pl) {
  let card = document.createElement("div");
  card.id = getPlayerCardId(pl.id);
  card.classList.add("player-card");

  let placeEle = document.createElement("div");
  placeEle.id = getPlayerPlaceId(pl);
  placeEle.innerText = `${pl.place}`;
  placeEle.style.position = "absolute";
  placeEle.style.left = "0px";
  placeEle.style.top = "0px";
  placeEle.classList.add("text");

  card.appendChild(placeEle);

  let contentEle = document.createElement("div");
  contentEle.classList.add("player-card-content");

  let nameEle = document.createElement("div");
  nameEle.innerText = pl.name;
  nameEle.classList.add("text");
  
  let pointsEle = document.createElement("div");
  pointsEle.innerText = `${pl.score} points`;
  pointsEle.classList.add("text");

  contentEle.appendChild(nameEle);
  contentEle.appendChild(pointsEle);

  card.appendChild(contentEle);
  
  return card;
}*/

function logMessage(msg, color = "info") {
  let div = document.createElement("div");
  div.textContent = msg;
  div.style.color = `var(--log-text-${color})`;
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
}

function getTileOverlayId(imgId) {
  return imgId + "-tile";
}

// Update the displayed game settings
function dispGameSettings(settings) {
  console.log("Game settings:", settings);
  gameEndTypeInput.value = settings.endCondition.type;
  updateGameEndInput();
  if (settings.endCondition.type == "rounds") {
    roundsInput.value = settings.endCondition.value.toString();
  }
  else if (settings.endCondition.type == "points") {
    pointsInput.value = settings.endCondition.value.toString();
  }
  listenTimeInput.value = settings.listenTime.toString();
  guessesInput.value = settings.guesses.toString();
}

function updateGameEndInput() {
    if (gameEndTypeInput.value == "rounds") {
      hideEle(pointsInput);
      showEle(roundsInput);
    }
    else if (gameEndTypeInput.value == "points") {
      hideEle(roundsInput);
      showEle(pointsInput);
    }
}

function initTilesSection(m) {
  let images = document.createDocumentFragment();
  for (let movie of m) {
    // The tile element (parent of image and overlay)
    let tile = document.createElement("div");
    tile.classList.add("tile");

    let img = document.createElement("img");
    img.src = "../images/album-covers/544px/" + movie.imageId + ".jpg";
    img.alt = movie.name;
    img.classList.add("tile-image");
    tile.appendChild(img);

    let overlay = document.createElement("div");
    overlay.id = getTileOverlayId(movie.imageId);
    overlay.innerText = movie.name;
    overlay.classList.add("tile-overlay");

    // the overlay has the higher z-index, so it has the click event listener
    overlay.addEventListener("click", function(e) {
      if (game.roundInProgress && ytPlayer.songPlaying && player.guessesLeft && !player.roundDone) {
        let guessOverlayId = e.target.id;

        if (!ui.wrongGuessIds.includes(guessOverlayId)) {
          player.guessesLeft--;
          updateGuessesLeft();
          
          let overlayEle = document.getElementById(guessOverlayId);
          overlayEle.classList.add("tile-overlay-guessed");
          
          if (guessOverlayId == getTileOverlayId(game.currMovie.imageId)) {
            let ms = getElapsedSongTime();
            
            player.roundDone = true;
            player.gotCorrect = true;

            
            socket.emit("correct guess", ms, player.guessesLeft);
            game.roundResults.push({
              player: {
                id: player.id,
                name: player.name,
              },
              result: "correct",
              guessesLeft: player.guessesLeft,
              time: ms / 1000,
            });

            overlayEle.classList.add("tile-overlay-correct");
            ui.correctGuessId = guessOverlayId;
            let s = formatMs(ms);
            logMessage(`You guessed correctly in: ${s}s`, "success");
          }
          else {
            let time = getElapsedSongTime();
            overlayEle.classList.add("tile-overlay-incorrect");
            ui.wrongGuessIds.push(guessOverlayId);
            if (player.guessesLeft == 0) {
              player.roundDone = true;
              game.roundResults.push({
                player: {
                  id: player.id,
                  name: player.name,
                },
                result: "ran out of guesses",
                guessesLeft: 0,
                time: time,
              });
              logMessage(`You ran out of guesses.`, "error");
              socket.emit("ran out of guesses", time);
            }
          }
        }
      }
    });

    tile.appendChild(overlay);

    images.appendChild(tile);
  }
  tilesSection.appendChild(images);
}

function updateGuessesLeft() {
  if (!player.DQed) {
    guessesLeftEle.innerText = player.guessesLeft;
  }
  else {
    guessesLeftEle.innerText = player.guessesLeft + " (DISQUALIFIED)";
  }
}


// Game flow functions

function resetGameVariables() {
  player.name = null;
  player.isOwner = null;
  game.settings = null;
  game.movies = null;
  game.inProgress = false;
}

function resetRoundVariables() {
  game.currMovie = null;
  game.currSong = null;
  game.roundInProgress = false;
  game.roundResults = [];

  ytPlayer.songPlaying = false;
  ytPlayer.stretchStartTime = null;
  ytPlayer.cumStretchTime = 0;

  player.gotCorrect = null;
  player.guessesLeft = null;
  player.roundDone = null;
  player.DQed = null;
}


function resetTiles() {
  for (let id of ui.wrongGuessIds) {
    let ele = document.getElementById(id)
    ele.classList.remove("tile-overlay-incorrect", "tile-overlay-guessed");
  }
  ui.wrongGuessIds = [];
  if (ui.correctGuessId) {
    let ele = document.getElementById(ui.correctGuessId);
    ele.classList.remove("tile-overlay-correct", "tile-overlay-guessed");
  }
  ui.correctGuessId = null;
}


// Preps the round and begins the countdown to play the song
function startRound() {

  game.roundInProgress = true;

  player.gotCorrect = false;
  player.guessesLeft = game.settings.guesses;
  
  player.roundDone = false;
  player.DQed = false;

  game.roundResults = [];
  
  updateGuessesLeft();

  resetTiles();

  logMessage(`Round ${game.round} starting!`);

  countDown(3, startSong);
}

// Starts the song and progress bar
function startSong() {
  YT_PLAYER.playVideo();
  progressBarInterval = window.setInterval(updateProgressBar, 1000/60);
}

// Stops the video and progress bar
function stopSong() {
  YT_PLAYER.stopVideo();
  window.clearInterval(progressBarInterval);
  roundStatusEle.innerText = "Song done.";
}

// resets round variables
function endRound() {
  stopSong();
  resetRoundVariables();
}

// Second-counting utility function (temp?)
function countDown(time) {
  // Make sure the player didn't quit right after the countdown started.
  if (!player.joinedGame) {
    return;
  }

  roundStatusEle.innerText = `Round starting in: ${time}`;
  if (time == 0) {
    startSong();
    return;
  }
  setTimeout(countDown, 1000, time - 1);
}

function updateProgressBar() {
  if (ytPlayer.songPlaying) {
    let t = getElapsedSongTime();

    progressBar.style.width =
      (t / game.settings.listenTime * 100).toString() + "%";

    if (t > game.settings.listenTime) {
      if (player.guessesLeft && !player.gotCorrect && !player.DQed) {
        player.roundDone = true;
        game.roundResults.push({
          player: {
            id: player.id,
            name: player.name,
          },
          result: "timeout",
          guessesLeft: player.guessesLeft,
          time: game.settings.listenTime,
        });
        logMessage("You timed out.", "error");
        socket.emit("timed out", player.guessesLeft);
      }
      stopSong();
    }
  }
}


// Event listeners

// Create a game
createGameButton.addEventListener("click", function(event) {
  if (Boolean(nameInput.value) && Boolean(gameIdInput.value)) {
    player.name = nameInput.value;
    socket.emit("player name", nameInput.value);
    socket.emit("create game", gameIdInput.value);
  }
});

// Join a game
joinGameButton.addEventListener("click", function() {
  if (Boolean(nameInput.value) && Boolean(gameIdInput.value)) {
    player.name = nameInput.value;
    socket.emit("player name", nameInput.value);
    socket.emit("join game", gameIdInput.value);
  }
});

// Game settings
gameEndTypeInput.addEventListener("change", function() {
  updateGameEndInput();
  // Make sure this player is allowed to change this input.
  if (player.isOwner) {
    let type = gameEndTypeInput.value;
    game.settings.endCondition.type = type;
    socket.emit("change game setting", "endConditionType", type);

    // Update the end condition value
    if (type == "rounds") {
      socket.emit("change game setting", "endConditionValue", Number(roundsInput.value));
    }
    else {
      socket.emit("change game setting", "endConditionValue", Number(pointsInput.value));
    }
  }
});

roundsInput.addEventListener("change", function() {
  if (player.isOwner && game.settings.endCondition.type == "rounds") {
    game.settings.endCondition.value = Number(roundsInput.value);
    socket.emit("change game setting", "endConditionValue", Number(roundsInput.value));
  }
});

pointsInput.addEventListener("change", function() {
  console.log("points changed:", game.settings);
  if (player.isOwner && game.settings.endCondition.type == "points") {
    game.settings.endCondition.value = Number(pointsInput.value);
    socket.emit("change game setting", "endConditionValue", Number(pointsInput.value));
  }
});

listenTimeInput.addEventListener("change", function() {
  if (player.isOwner) {
    game.settings.listenTime = Number(listenTimeInput.value);
    socket.emit("change game setting", "listenTime", Number(listenTimeInput.value));
  }
});

guessesInput.addEventListener("change", function() {
  if (player.isOwner) {
    game.settings.guesses = Number(guessesInput.value);
    socket.emit("change game setting", "guesses", Number(guessesInput.value));
  }
});


startButton.addEventListener("click", function() {
  socket.emit("start game");
});

// Start next round when next button clicked (temp)
nextButton.addEventListener("click", function() {
  socket.emit("start next round");
});

// Volume listening
volumeSlider.addEventListener("input", function() {
  YT_PLAYER.setVolume(Number(volumeSlider.value));
});

volumeSlider.addEventListener("change", function() {
  YT_PLAYER.setVolume(Number(volumeSlider.value));
});

quitButton.addEventListener("click", function() {
  if (ui.quitButtonActive && player.joinedGame) {
    socket.emit("leave game");

    // Switch to the intro view
    hideEle(gameView);
    hideEle(gameplaySection);
    showEle(settingsSection);
    showEle(introView);
    
    // If a player's round is in progress, end it
    endRound();

    // Reset the game
    resetGameVariables();
    resetGameUI();

    // update status variables
    player.joinedGame = false;
    ui.currView = "intro";

    // Reset the quit button
    quitButton.innerText = "Quit";
    ui.quitButtonActive = false;
  }
  else {
    quitButton.innerText = "Quit?";
    ui.quitButtonActive = true;
    
    // Return to former state after 3 seconds
    setTimeout(() => {
      quitButton.innerText = "Quit";
      ui.quitButtonActive = false;
    }, 3000);
  }
});

// DQing
/*window.addEventListener("blur", function() {
  console.log("blur!", performance.now());
  if (game.roundInProgress && !player.roundDone) {
    player.roundDone = true;
    player.DQed = true;
    logMessage("You cannot leave the page during a round. You have been disqualified.", "error");
    // Update the guesses left status message to display the DQ
    updateGuessesLeft();
    sendDQ();
  }
});
*/

document.addEventListener("keydown", function(event) {
  if (!event.key) {
    return;
  }
  if (event.key.slice(0, 5) == "Audio" || event.key.slice(0, 5) == "Media") {
    if (game.roundInProgress && !player.roundDone) {
      player.roundDone = true;
      player.DQed = true;
      logMessage("No audio or media keys allowed! You have been disqualified.", "error");
      updateGuessesLeft();
      sendDQ();
    }
  }
});

function sendDQ() {
  if (game.roundInProgress) {
    let time = getElapsedSongTime();
    game.roundResults.push({
      player: {
        id: player.id,
        name: player.name,
      },
      result: "disqualified",
      guessesLeft: player.guessesLeft,
      time: time,
    });
    socket.emit("disqualified", time, player.guessesLeft);
  }
}


// Socket events

// when id for game creation is rejected
socket.on("game id already exists", () => {
  alert("This game ID already exists. Please choose a different one.");
});

// when id for joining game is rejected
socket.on("game id not found", () => {
  alert("Game ID not found. Check for typos, or create a new game with this ID by clicking \"Create Game\"");
});

// when game user is attempting to join has already started
socket.on("game already in progress", () => {
  alert("This game has already started.");
});

// when we receive confirmation that a game was successfully created:
socket.on("game created", (gameObj, id) => {
  game.settings = gameObj.settings;
  dispGameSettings(game.settings);
  
  player.id = id;

  player.isOwner = true;

  // Open all settings inputs
  for (let input of settingsInputs) {
    input.removeAttribute("disabled");
  }
  
  if (!game.movies) {
    socket.emit("request movie data");
  }

  showEle(startButton);

  hideEle(introView);
  showEle(gameView);

  player.joinedGame = true;
  ui.currView = "gameSettings";

  // Add name to initial player list (element and array)
  // playerList.appendChild(createPlayerCard(gameObj.players[0]));
  game.players = [gameObj.players[0]];

  game.round = 0;
});

// when we receive confirmation that a game was successfully joined:
socket.on("game joined", (gameObj, id) => {
  game.settings = gameObj.settings;
  dispGameSettings(game.settings);

  player.id = id;

  player.isOwner = false;

  // Block all settings inputs
  for (let input of settingsInputs) {
    input.setAttribute("disabled", true);
  }

  if (!game.movies) {
    socket.emit("request movie data");
  }
  else {
    initTilesSection(game.movies);
  }

  hideEle(startButton);

  hideEle(introView);
  showEle(gameView);

  player.joinedGame = true;
  ui.currView = "gameSettings";
  
  /*for (let pl of gameObj.players) {
    playerList.appendChild(createPlayerCard(pl));
  }*/

  game.players = gameObj.players;

  game.round = 0;
});

// when another player joins the game
socket.on("player joined game", (pl) => {
  //playerList.appendChild(createPlayerCard(pl));
  game.players.push(pl);
  logMessage(`${pl.name} joined the game.`);
});

// when another player leaves the game
socket.on("player left game", (pl) => {
  //playerList.removeChild(document.getElementById(getPlayerCardId(pl.id)));
  game.players = game.players.filter((p) => p.id != pl.id);
  logMessage(`${pl.name} left the game.`);
});

socket.on("game setting changed", (setting, val) => {
  switch (setting) {
    case "endConditionType":
      gameEndTypeInput.value = val;
      game.settings.endCondition.type = val;
      updateGameEndInput();
      break;
    case "endConditionValue":
      game.settings.endCondition.value = val;
      if (game.settings.endCondition.type == "rounds") {
        roundsInput.value = val.toString();
      }
      else {
        pointsInput.value = val.toString();
      }
      break;
    case "listenTime":
      listenTimeInput.value = val.toString();
      game.settings.listenTime = val;
      break;
    case "guesses":
      guessesInput.value = val.toString();
      game.settings.guesses = val;
  }
  console.log(game.settings);
});

socket.on("now owner", () => {
  if (ui.currView == "intro") return;
  player.isOwner = true;
  if (player.joinedGame && ui.currView == "gameSettings") {
    for (let input of settingsInputs) {
      input.removeAttribute("disabled");
    }
    showEle(startButton);
    logMessage("You are now the room owner.");
  }
});

socket.on("game started", (gameObj) => {
  console.log("Game started!:", gameObj);
  hideEle(settingsSection);
  showEle(gameplaySection);
  ui.currView = "gameplay";
  logMessage("The game has started!");
});

socket.on("player guessed correctly", (pl, ms, guessesLeft) => {
  game.roundResults.push({
    player: {
      id: pl.id,
      name: pl.name,
    },
    result: "correct",
    guessesLeft: guessesLeft,
    time: ms / 1000,
  });
  logMessage(`${pl.name}: ${formatMs(ms)}s`, "success");
});

socket.on("player ran out of guesses", (pl, ms) => {
  game.roundResults.push({
    player: {
      id: pl.id,
      name: pl.name,
    },
    result: "ran out of guesses",
    guessesLeft: 0,
    time: ms,
  });
  logMessage(`${pl.name} ran out of guesses.`, "error");
});

socket.on("player timed out", (pl, guessesLeft) => {
  game.roundResults.push({
    player: {
      id: pl.id,
      name: pl.name,
    },
    result: "timeout",
    guessesLeft: guessesLeft,
    time: game.settings.listenTime,
  });
  logMessage(`${pl.name} timed out.`, "error");
});

socket.on("player disqualified", (pl, ms, guessesLeft) => {
  game.roundResults.push({
    player: {
      id: pl.id,
      name: pl.name,
    },
    result: "disqualified",
    guessesLeft: guessesLeft,
    time: ms,
  });
  logMessage(`${pl.name} was disqualified.`, "error");
});

// when we receive the movie data
socket.on("movie data", (data) => {
  game.movies = data;

  // Sort movies by sorting name
  game.movies.sort((a, b) => a.sortingName > b.sortingName ? 1 : b.sortingName > a.sortingName ? -1 : 0);

  // Create image tiles
  initTilesSection(game.movies);
});

// when we receive data for the next round
socket.on("next round", (data) => {
  game.round++;

  game.settings.listenTime = data.timeMs;
  game.currMovie = data.movie;
  game.currSong = data.song;

  YT_PLAYER.cueVideoById({
    videoId: game.currSong.ytId,
    startSeconds: data.startSeconds,
  });

  startRound();
});

socket.on("round done", (results) => {
  logMessage("Round done.");
  logMessage(`Movie: ${game.currMovie.name}`);
  logMessage(`Song: ${game.currSong.name}`);
  for (let i = 0; i < results.length; i++) {
    let color;
    let res = results[i]
    if (res.result == "correct") {
      color = "success";
    }
    else {
      color = "error";
    }
    let pl = res.player;
    logMessage(`${pl.name}: +${res.score}`, color);
    //document.getElementById(getPlayerCardId(pl.id)).children[1].children[1].innerText = `${pl.score} points`;
  }

  endRound();
});

})();
