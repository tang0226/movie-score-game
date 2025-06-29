class Game {
  constructor(id, owner) {
    this.id = id;
    this.owner = owner;
    this.settings = {};
    this.players = [];
    this.movies = [];
    this.inProgress = false;
    this.roundInProgress = false;
    this.roundResults = [];
  }

  initSettings(settings) {
    this.settings = settings;
  }

  setMovies(movies) {
    this.movies = movies;
  }

  modifySetting(key, val) {
    this.settings[key] = val;
  }

  addPlayer(player) {
    this.players.push(player);
    player.gameId = this.id;
    player.score = 0;
    player.place = 1;
  }

  removePlayerById(id) {
    this.players = this.players.filter((p) => p.id != id);
  }

  isRoundFinished() {
    if (this.roundResults.length == this.players.length) {
      return true;
    }
    else if (this.roundResults.length > this.players.length) {
      console.log("Error!");
      console.log(this.players);
      console.log(this.roundResults);
      throw new Error(`ERROR: Game ${this.id} has an extra round result`);
    }
  }
}

module.exports = { Game };
