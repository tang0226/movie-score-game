const express = require('express');
const { createServer } = require('node:http');
const { join } = require('node:path');
const { Server } = require('socket.io');

const { Song } = require("./classes/song.js");
const { Movie } = require("./classes/movie.js");
const { Player } = require("./classes/player.js");
const { Game } = require("./classes/game.js");

const fs = require("node:fs");

const app = express();
const server = createServer(app);
const io = new Server(server);

app.use(express.static("public"));

app.get('/', (req, res) => {
  res.sendFile(join(__dirname, 'index.html'));
});

var movies = [];

// Read movie data from text file
fs.readFile(join(__dirname, "data.txt"), "utf8", (err, txt) => {
  if (err) {
    console.error(err);
    return;
  }
  let lines = txt.split("\r\n");

  let currMovieName = "";
  let currSongs = [];
  for (let line of lines) {
    if (Boolean(line.trim())) {
      if (line.slice(-1) == ":") {
        movies.push(new Movie(currMovieName, currSongs));
        currMovieName = line.slice(0, -1);
        currSongs = [];
      }
      else {
        let parts = line.split(";");
        if (parts.length != 4) {
          console.log("ERROR: NOT ENOUGH PARTS IN LINE:", line);
        }
        if (parts[1].length != 11) {
          console.log("ERROR: WRONG NUMBER OF CHARACTERS IN VIDEO ID:", line);
        }
        currSongs.push(new Song(parts[0], parts[1], Number(parts[2]), Number(parts[3])));
      }
    }
  }

  movies.push(new Movie(currMovieName, currSongs));
  movies = movies.slice(1);
});


function getRoomId(gameId) {
  return gameId + "-room";
}


var players = [];
var playersById = {};
var games = [];
var gamesById = {};

io.on('connection', (socket) => {
  const ID = socket.id;
  const IP = socket.handshake.address;
  console.log(ID, IP, "connected");

  // Player name submitted
  socket.on("player name", (name) => {
    console.log(ID, "name:", name);
    if (typeof(playersById[ID]) == "undefined") {
      //io.emit('chat message', msg); // send back the chat msg to all other clients
      let player = new Player(name, ID);
      players.push(player);
      playersById[ID] = player;
    }
    else {
      playersById[ID].name = name;
    }
  });

  // Game created
  socket.on("create game", (gameId) => {
    if (typeof(gamesById[gameId]) == "undefined") {
      let owner = playersById[ID];
      if (!owner) return;

      // Mark the creator as the owner
      owner.isOwner = true;
      console.log(ID, "created game", gameId);

      let game = new Game(gameId, ID);
      
      game.initSettings({
        endCondition: {
          type: "rounds",
          value: 10,
        },
        listenTime: 60,
        guesses: 3,
      });

      game.settings.listenTimeMs = game.settings.listenTime * 1000;

      game.addPlayer(owner);
      game.owner = owner;
      games.push(game);
      gamesById[gameId] = game;
      
      socket.join(getRoomId(gameId));

      io.to(ID).emit("game created", game, ID);
    }
    else {
      console.log(ID, "attempted to create game", gameId.toString() + "; already exists");
      io.to(ID).emit("game id already exists")
    }
  });

  // Game joined
  socket.on("join game", (gameId) => {
    let game = gamesById[gameId];
    let player = playersById[ID];
    
    if (typeof(game) != "undefined") {
      if (game.inProgress) {
        io.to(ID).emit("game already in progress");
        console.log(ID, "attempted to join game", gameId.toString() + "; already started");
        return;
      }
      console.log(ID, "joined game", gameId);

      game.addPlayer(player);

      // message the rest of the room BEFORE this socket joins
      io.to(getRoomId(gameId)).emit("player joined game", player);

      socket.join(getRoomId(gameId));

      io.to(ID).emit("game joined", game, ID);
    }
    else {
      console.log(ID, "attempted to join game", gameId.toString() + "; not found");
      io.to(ID).emit("game id not found");
    }
  });

  // Game quitted
  socket.on("leave game", () => {
    let player = playersById[ID];
    if (!player) return;

    let game = gamesById[player.gameId];
    if (!game) return;

    game.removePlayerById(ID);
    player.gameId = null;


    // Inform all other players of the quit
    let roomId = getRoomId(game.id);
    
    // Have this socket leave the room before announcing the quit, so that
    // the quitting user does not get messaged
    socket.leave(roomId);

    io.to(roomId).emit("player left game", player);

    // Delete game if no players left
    if (game.players.length == 0) {
      games = games.filter(g => !(g.id = game.id));
      gamesById[game.id] = undefined;
      console.log("Game", game.id, "deleted");
    }
    else {
      // If the leaving player was the room owner, pick a new one
      if (player.isOwner) {
        let newOwner = game.players[0];
        newOwner.isOwner = true;
        io.to(getRoomId(game.id)).emit("new owner", newOwner);
      }
    }
  });

  // Game setting changed
  socket.on("change game setting", (setting, val) => {
    let player = playersById[ID];
    if (!player) return;
    let game = gamesById[player.gameId];
    if (!game) return;
    switch (setting) {
      case "endConditionType":
        game.settings.endCondition.type = val;
        break;
      case "endConditionValue":
        game.settings.endCondition.value = val;
        break;
      case "listenTime":
        game.settings.listenTime = val;
        break;
      case "guesses":
        game.settings.guesses = val;
        break;
    }
    for (let p of game.players) {
      if (p.id != ID) {
        io.to(p.id).emit("game setting changed", setting, val);
      }
    }
  });

  socket.on("start game", () => {
    let player = playersById[ID];
    if (!player) return;
    let game = gamesById[player.gameId];
    if (!game) return;
    game.inProgress = true;
    // Results organized by round
    game.results = [];

    io.to(getRoomId(game.id)).emit("game started", game);

    console.log(ID, "started game", game.id);
  });

  // Movie data requested
  socket.on("request movie data", () => {
    io.to(ID).emit("movie data", movies);
  });

  // Next song requested
  socket.on("start next round", () => {
    let player = playersById[ID];
    if (!player) return;
    let game = gamesById[player.gameId];
    if (!game) return;
    let movie, song;
    
    game.roundResults = [];
    game.roundResultsById = {};

    do {
      movie = movies[Math.floor(Math.random() * movies.length)];
      song = movie.songs[Math.floor(Math.random() * movie.songs.length)];
    } while (song.length < game.settings.listenTime);

    let listenTime = game.settings.listenTime;
    let startSeconds = song.getRandomTime(listenTime);

    // Get game room based on player's socket id
    io.to(getRoomId(game.id)).emit("next round", {
      movie: movie,
      song: song,
      startSeconds: startSeconds,
      endSeconds: startSeconds + listenTime,
      timeMs: listenTime * 1000,
    });

    game.roundInProgress = true;
  });

  // General round result
  socket.on("player round result", (result) => {
    let player = playersById[ID];
    if (!player) return;
    let game = gamesById[player.gameId];
    if (!game) return;

    game.roundResults.push(result);

    if (game.roundResultsById[ID]) {
      console.log(`ERROR: PLAYER ${result.player.name} ALREADY HAS ROUND RESULT`);
    }

    game.roundResultsById[ID] = result;

    for (let p of game.players) {
      if (p.id != ID) {
        io.to(p.id).emit("player round result", result);
      }
    }

    // check if all players have a result
    if (game.isRoundFinished()) {

      // if so, the round is done
      endRound(game);
    }
  });

  // Client disconnected
  socket.on('disconnect', () => {
    let player = playersById[ID];
    if (!player) return;

    // Delete player from list and map
    players = players.filter(p => !(p.id == ID));
    playersById[ID] = undefined;

    let game = gamesById[player.gameId];

    if (!game) return;


    // remove from list of game players
    game.players = game.players.filter(p => p.id != ID);

    // Check if this player has results in this game's current round
    if (game.roundResults.filter(r => r.player.id == ID)) {
      // if found, remove it
      game.roundResults = game.roundResults.filter(r => r.player.id != ID);
    }

    // remove socket from the room
    socket.leave(getRoomId(game.id));

    io.to(getRoomId(game.id)).emit("player left game", player);
    
    if (game.players.length == 0) {
      // Delete game if no players left
      games = games.filter(g => !(g.id = game.id));
      gamesById[game.id] = undefined;
      console.log("Game", game.id, "deleted");
    }
    else {
      // If the disconnected player was the owner, pick a new one
      if (player.isOwner) {
        let newOwner = game.players[0];
        newOwner.isOwner = true;
        io.to(getRoomId(game.id)).emit("new owner", newOwner);
      }
    }

    console.log(ID, "disconnected");
  });
});


server.listen(3000, () => {
  console.log('server running at http://localhost:3000');
});


function endRound(game) {
  // sort based on results (correct and fastest at top)
  game.roundResults.sort(function(a, b) {
    if (a.result == "correct") {
      if (b.result == "correct") {
        return a.time - b.time;
      }
      return -1;
    }
    else if (b.result == "correct") {
      if (a.result == "correct") {
        return b.time - a.time;
      }
      return 1;
    }
    return 0;
  });


  for (let i = 0; i < game.roundResults.length; i++) {
    if (game.roundResults[i].result == "correct") {
      let points = Math.round(1000 * (1 - game.roundResults[i].time / (game.settings.listenTime * 1000)));
      game.roundResults[i].score = points;
    }
    else {
      game.roundResults[i].score = 0;
    }
  }

  game.cumResults.push(game.roundResults);
  for (let key of Object.keys(game.roundResultsById)) {
    game.cumResultsById[key].push(game.roundResultsById[key]);
  }

  io.to(getRoomId(game.id)).emit("round done", game.roundResults, game.roundResultsById);
}
