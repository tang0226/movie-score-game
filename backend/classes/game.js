class Game {
  constructor(id, owner) {
    this.id = id;
    this.owner = owner;
    this.settings = {};
    this.players = [];
    this.movies = [];
    this.inProgress = false;
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
}

module.exports = { Game };
