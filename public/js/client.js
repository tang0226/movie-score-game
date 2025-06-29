/**
TODO / PLANNING:
Store player information locally
v Times go to server.
v Server sends times to clients.
Clients receive times ("player guessed correctly" msg)
Server calculates scores.
Scores get sent to clients.
Next round starts when all players confirm OR after 15 seconds


IDEAS FOR LAYOUT:
HUD, volume, timing bar, and movie tiles in center
Left: Scoreboard (name: points), with progress-bar-style graphing of relative points.
Right: log (players joining, leaving, guessing, dq-ing, winning)

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
      if (roundInProgress) {
        stretchStartTime = performance.now();

        if (!songBuffering) {
          cumStretchTime = 0;
        }
        else {
          songBuffering = false;
        }

        songPlaying = true;
      }
      break;
    case 2:
      YT_PLAYER.playVideo();
      break;
    case 3:
      if (songPlaying) {
        console.error("BUFFERING");
        cumStretchTime += performance.now() - stretchStartTime;
        stretchStartTime = null;
        songPlaying = false;
        songBuffering = true;
      }
  }
}




function getElapsedSongTime() {
  return performance.now() - stretchStartTime + cumStretchTime;
}

// Variables for storing lengths of stretches (between buffers)
var stretchStartTime = null, cumStretchTime = 0, roundInProgress = false,
  songPlaying = false, songBuffering = false;

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
var countdownEle = document.getElementById("countdown");
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
var quitButtonActive;
var round = 0;
var playerName, playerId, isOwner, joinedGame, gameSettings, players, movies, currView,
  gameInProgress, currMovie, currSong, listenTime, gotCorrect, guessesLeft, roundResults = [],
  playerDone, playerDQed;

const TIME_DP = 2;
function formatMs(ms) {
  return Math.round(ms / 1000 * 10 ** TIME_DP) / 10 ** TIME_DP
}

// Array of overlays that contain incorrect guesses
var wrongGuessIds = [];
var correctGuessId;



// HTML and DOM functions

// Clears the player list and tiles section
function resetGameUI() {
  playerList.innerHTML = "";
  tilesSection.innerHTML = "";
  progressBar.style.width = "0px";
  guessesLeftEle.innerText = "";
  log.innerHTML = "<div>Welcome to ScoreGame!</div>";
}

function createPlayerCard(player) {
  let card = document.createElement("div");
  card.id = getPlayerCardId(player.id);
  card.classList.add("player-card");

  let placeEle = document.createElement("div");
  placeEle.innerText = `${player.place}`;
  placeEle.style.position = "absolute";
  placeEle.style.left = "0px";
  placeEle.style.top = "0px";
  placeEle.classList.add("text");

  card.appendChild(placeEle);

  let contentEle = document.createElement("div");
  contentEle.classList.add("player-card-content");

  let nameEle = document.createElement("div");
  nameEle.innerText = player.name;
  nameEle.classList.add("text");
  
  let pointsEle = document.createElement("div");
  pointsEle.innerText = `${player.score} points`
  pointsEle.classList.add("text");

  contentEle.appendChild(nameEle);
  contentEle.appendChild(pointsEle);

  card.appendChild(contentEle);
  
  return card;
}

function logMessage(msg, color = "info") {
  let div = document.createElement("div");
  div.textContent = msg;
  div.style.color = `var(--log-text-${color})`;
  log.appendChild(div);
}

function getPlayerCardId(id) {
  return id + "-card";
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
      if (roundInProgress && songPlaying && guessesLeft && !playerDone) {
        let guessOverlayId = e.target.id;

        if (!wrongGuessIds.includes(guessOverlayId)) {
          guessesLeft--;
          updateGuessesLeft();
          
          let overlayEle = document.getElementById(guessOverlayId);
          overlayEle.classList.add("tile-overlay-guessed");
          
          if (guessOverlayId == getTileOverlayId(currMovie.imageId)) {
            let ms = getElapsedSongTime();
            
            socket.emit("correct guess", ms, guessesLeft);
            roundResults.push({
              player: playerId,
              result: "correct",
              guessesLeft: guessesLeft,
              time: ms / 1000,
            });
            console.log(roundResults);

            overlayEle.classList.add("tile-overlay-correct");
            gotCorrect = true;
            correctGuessId = guessOverlayId;
            playerDone = true;
            let s = formatMs(ms);
            logMessage(`You guessed correctly in: ${s}s`, "success");
          }
          else {
            overlayEle.classList.add("tile-overlay-incorrect");
            wrongGuessIds.push(guessOverlayId);
            if (guessesLeft == 0) {
              playerDone = true;
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
  if (!playerDQed) {
    guessesLeftEle.innerText = guessesLeft;
  }
  else {
    guessesLeftEle.innerText = guessesLeft + " (DISQUALIFIED)";
  }
}


// Game flow functions

function resetGameVariables() {
  playerName = null;
  isOwner = null;
  gameSettings = null;
  movies = null;
  gameInProgress = false;
}

// When a round ends
function resetRoundVariables() {
  roundInProgress = false;
  songPlaying = false;
  stretchStartTime = null;
  cumStretchTime = 0;
  currMovie = null;
  currSong = null;
  listenTime = null;
  gotCorrect = null;
  guessesLeft = null;
  roundResults = [];
}

function resetTiles() {
  for (let id of wrongGuessIds) {
    let ele = document.getElementById(id)
    ele.classList.remove("tile-overlay-incorrect", "tile-overlay-guessed");
  }
  wrongGuessIds = [];
  if (correctGuessId) {
    let ele = document.getElementById(correctGuessId);
    ele.classList.remove("tile-overlay-correct", "tile-overlay-guessed");
  }
  correctGuessId = null;
}


// Preps the round and begins the countdown to play the song
function startRound() {
  roundInProgress = true;

  gotCorrect = false;
  guessesLeft = gameSettings.guesses;
  
  playerDone = false;
  playerDQed = false;
  
  updateGuessesLeft();

  resetTiles();

  logMessage(`Round ${round} starting!`);

  countDown(3, startSong);
}

// Starts the song and progress bar
function startSong() {
  YT_PLAYER.playVideo();
  progressBarInterval = window.setInterval(updateProgressBar, 1000/60);
}

// Stops the video and progress bar and resets round variables
function endRound() {
  YT_PLAYER.stopVideo();
  window.clearInterval(progressBarInterval);
  console.log("round done:", getElapsedSongTime());
  resetRoundVariables();
}

// Second-counting utility function (temp?)
function countDown(time, callback, ...args) {
  countdownEle.innerText = time;
  if (time == 0) {
    callback(...args);
    return;
  }
  setTimeout(countDown, 1000, time - 1, callback, ...args);
}

function updateProgressBar() {
  if (songPlaying) {
    let t = getElapsedSongTime();

    progressBar.style.width =
      (t / listenTime * 100).toString() + "%";

    if (t > listenTime) {
      if (guessesLeft && !gotCorrect) {
        roundResults.push({
          player: playerId,
          result: "timeout",
          guessesLeft: guessesLeft,
          time: listenTime,
        });
        logMessage("You timed out.", "error");
        socket.emit("timed out.", guessesLeft);
        console.log(roundResults);
      }
      endRound();
    }
  }
}


// Event listeners

// Create a game
createGameButton.addEventListener("click", function(event) {
  if (Boolean(nameInput.value) && Boolean(gameIdInput.value)) {
    playerName = nameInput.value;
    socket.emit("player name", nameInput.value);
    socket.emit("create game", gameIdInput.value);
  }
});

// Join a game
joinGameButton.addEventListener("click", function() {
  if (Boolean(nameInput.value) && Boolean(gameIdInput.value)) {
    playerName = nameInput.value;
    socket.emit("player name", nameInput.value);
    socket.emit("join game", gameIdInput.value);
  }
});

// Game settings
gameEndTypeInput.addEventListener("change", function() {
  updateGameEndInput();
  // Make sure this player is allowed to change this input.
  if (isOwner) {
    let type = gameEndTypeInput.value;
    gameSettings.endCondition.type = type;
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
  if (isOwner && gameSettings.endCondition.type == "rounds") {
    gameSettings.endCondition.value = Number(roundsInput.value);
    socket.emit("change game setting", "endConditionValue", Number(roundsInput.value));
  }
});

pointsInput.addEventListener("change", function() {
  console.log("points changed:", gameSettings);
  if (isOwner && gameSettings.endCondition.type == "points") {
    gameSettings.endCondition.value = Number(pointsInput.value);
    socket.emit("change game setting", "endConditionValue", Number(pointsInput.value));
  }
});

listenTimeInput.addEventListener("change", function() {
  if (isOwner) {
    gameSettings.listenTime = Number(listenTimeInput.value);
    socket.emit("change game setting", "listenTime", Number(listenTimeInput.value));
  }
});

guessesInput.addEventListener("change", function() {
  if (isOwner) {
    gameSettings.guesses = Number(guessesInput.value);
    socket.emit("change game setting", "guesses", Number(guessesInput.value));
  }
});


startButton.addEventListener("click", function() {
  socket.emit("start game");
});

// Start next round when next button clicked (temp)
nextButton.addEventListener("click", function() {
  if (roundInProgress) {
    endRound();
  }
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
  if (quitButtonActive && joinedGame) {
    socket.emit("quit game");

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
    joinedGame = false;
    currView = "intro";

    // Reset the quit button
    quitButton.innerText = "Quit";
    quitButtonActive = false;
  }
  else {
    quitButton.innerText = "Quit?";
    quitButtonActive = true;
    
    // Return to former state after 3 seconds
    setTimeout(() => {
      quitButton.innerText = "Quit";
      quitButtonActive = false;
    }, 3000);
  }
});

// DQing
/*window.addEventListener("blur", function() {
  console.log("blur!", performance.now());
  if (roundInProgress && !playerDone) {
    playerDone = true;
    playerDQed = true;
    logMessage("You cannot leave the page during a round.", "error");
    updateGuessesLeft();
  }
});*/

document.addEventListener("keydown", function(event) {
  if (!event.key) {
    return;
  }
  if (event.key.slice(0, 5) == "Audio" || event.key.slice(0, 5) == "Media") {
    if (roundInProgress && !playerDone) {
      playerDone = true;
      playerDQed = true;
      logMessage("No audio or media keys allowed!", "error");
      updateGuessesLeft();
    }
  }
});


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
socket.on("game created", (game, id) => {
  gameSettings = game.settings;
  dispGameSettings(gameSettings);
  
  playerId = id;

  isOwner = true;

  // Open all settings inputs
  for (let input of settingsInputs) {
    input.removeAttribute("disabled");
  }
  
  if (!movies) {
    socket.emit("request movie data");
  }

  showEle(startButton);

  hideEle(introView);
  showEle(gameView);

  joinedGame = true;
  currView = "gameSettings";

  console.log(game.players);

  // Add name to initial player list (element and array)
  playerList.appendChild(createPlayerCard(game.players[0]));
  players = [game.players[0]];
});

// when we receive confirmation that a game was successfully joined:
socket.on("game joined", (game, id) => {
  gameSettings = game.settings;
  dispGameSettings(gameSettings);

  playerId = id;

  isOwner = false;

  // Block all settings inputs
  for (let input of settingsInputs) {
    input.setAttribute("disabled", true);
  }

  if (!movies) {
    socket.emit("request movie data");
  }
  else {
    initTilesSection(movies);
  }

  hideEle(startButton);

  hideEle(introView);
  showEle(gameView);

  joinedGame = true;
  currView = "gameSettings";
  
  for (let player of game.players) {
    playerList.appendChild(createPlayerCard(player));
  }

  players = game.players;
});

// when another player joins the game
socket.on("player joined game", (player) => {
  playerList.appendChild(createPlayerCard(player));
  players.push(player);
  logMessage(`${player.name} joined the game.`);
});

// when another player quits the game
socket.on("player quit game", (player) => {
  playerList.removeChild(document.getElementById(getPlayerCardId(player.id)));
  players = players.filter((p) => p.id != player.id);
  logMessage(`${player.name} left the game.`);
});

socket.on("game setting changed", (setting, val) => {
  switch (setting) {
    case "endConditionType":
      gameEndTypeInput.value = val;
      gameSettings.endCondition.type = val;
      updateGameEndInput();
      break;
    case "endConditionValue":
      gameSettings.endCondition.value = val;
      if (gameSettings.endCondition.type == "rounds") {
        roundsInput.value = val.toString();
      }
      else {
        pointsInput.value = val.toString();
      }
      break;
    case "listenTime":
      listenTimeInput.value = val.toString();
      gameSettings.listenTime = val;
      break;
    case "guesses":
      guessesInput.value = val.toString();
      gameSettings.guesses = val;
  }
  console.log(gameSettings);
});

socket.on("now owner", () => {
  if (currView == "intro") return;
  isOwner = true;
  if (joinedGame && currView == "gameSettings") {
    for (let input of settingsInputs) {
      input.removeAttribute("disabled");
    }
    showEle(startButton);
    logMessage("You are now the room owner.");
  }
});

socket.on("game started", (game) => {
  console.log("Game started!:", game);
  hideEle(settingsSection);
  showEle(gameplaySection);
  currView = "gameplay";
  logMessage("The game has started!");
});

socket.on("player guessed correctly", (player, ms, guessesLeft) => {
  roundResults.push({
    player: player.id,
    result: "correct",
    guessesLeft: guessesLeft,
    time: ms / 1000,
  });
  logMessage(`${player.name}: ${formatMs(ms)}s`, "success");
  console.log(roundResults);
});

socket.on("player timed out", (player, guessesLeft) => {
  roundResults.push({
    player: player.id,
    result: "timeout",
    guessesLeft: guessesLeft,
    time: listenTime,
  });
  logMessage(`${player.name} timed out`, "error");
  console.log(roundResults);
});

// when we receive the movie data
socket.on("movie data", (data) => {
  movies = data;

  // Sort movies by sorting name
  movies.sort((a, b) => a.sortingName > b.sortingName ? 1 : b.sortingName > a.sortingName ? -1 : 0);

  // Create image tiles
  initTilesSection(movies);
});

// when we receive data for the next round
socket.on("next round", (data) => {
  round++;

  listenTime = data.time * 1000;
  currMovie = data.movie;
  currSong = data.song;

  YT_PLAYER.cueVideoById({
    videoId: currSong.ytId,
    startSeconds: data.startSeconds,
  });

  startRound();
});

})();
